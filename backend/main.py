from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import httpx
import asyncio
import re
from datetime import datetime, date
import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", os.getenv("SUPABASE_KEY"))  # service role key 可繞過 RLS
TW_TZ = pytz.timezone("Asia/Taipei")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 股票清單快取 ──────────────────────────────────────
_stock_cache: list[dict] = []

COMMON_US = [
    # 美股大盤 ETF
    {"symbol": "SPY",  "name": "S&P 500 ETF"},
    {"symbol": "QQQ",  "name": "Nasdaq 100 ETF"},
    {"symbol": "DIA",  "name": "Dow Jones ETF"},
    {"symbol": "IWM",  "name": "Russell 2000 ETF"},
    {"symbol": "VTI",  "name": "Vanguard Total Market ETF"},
    # 美股期貨（代表夜盤方向）
    {"symbol": "ES=F", "name": "S&P 500 期貨（美股夜盤）"},
    {"symbol": "NQ=F", "name": "Nasdaq 100 期貨（美股夜盤）"},
    {"symbol": "YM=F", "name": "道瓊期貨（美股夜盤）"},
    {"symbol": "RTY=F","name": "Russell 2000 期貨"},
    # 商品期貨
    {"symbol": "GC=F", "name": "黃金期貨"},
    {"symbol": "SI=F", "name": "白銀期貨"},
    {"symbol": "CL=F", "name": "原油期貨（WTI）"},
    {"symbol": "NG=F", "name": "天然氣期貨"},
    # 債券
    {"symbol": "TLT",  "name": "iShares 20yr Treasury"},
    {"symbol": "GLD",  "name": "SPDR Gold ETF"},
    # 個股
    {"symbol": "AAPL", "name": "Apple"},
    {"symbol": "MSFT", "name": "Microsoft"},
    {"symbol": "GOOGL","name": "Alphabet"},
    {"symbol": "AMZN", "name": "Amazon"},
    {"symbol": "NVDA", "name": "NVIDIA"},
    {"symbol": "TSLA", "name": "Tesla"},
    {"symbol": "META", "name": "Meta"},
    {"symbol": "TSM",  "name": "台積電 ADR"},
]

def is_tw_stock(symbol: str) -> bool:
    """判斷是否為台股（純數字 or 數字+英文字母，4~6碼）"""
    return bool(re.match(r'^\d{4,6}[A-Z]?$', symbol.upper()))

async def load_tw_stocks():
    global _stock_cache
    stocks = list(COMMON_US)
    try:
        async with httpx.AsyncClient(timeout=15, verify=False) as client:
            r1 = await client.get("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL")
            if r1.status_code == 200:
                for item in r1.json():
                    code = item.get("Code", "")
                    name = item.get("Name", "")
                    if code and name:
                        stocks.append({"symbol": code, "name": name})

            r2 = await client.get("https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes")
            if r2.status_code == 200:
                for item in r2.json():
                    code = item.get("SecuritiesCompanyCode", "")
                    name = item.get("CompanyName", "")
                    if code and name:
                        stocks.append({"symbol": code, "name": name})
    except Exception as e:
        print(f"載入股票清單時發生錯誤: {e}")

    _stock_cache = stocks
    print(f"✅ 股票清單載入完成，共 {len(stocks)} 筆")

scheduler = AsyncIOScheduler(timezone=TW_TZ)

async def auto_record_pnl():
    """每日收盤後自動計算並記錄所有用戶的未實現損益"""
    now = datetime.now(TW_TZ)
    today = now.strftime("%Y-%m-%d")
    # 只在週一到週五執行
    if now.weekday() >= 5:
        return

    print(f"[排程] 開始自動記錄 {today} 損益...")
    try:
        db = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)  # 使用 service role 繞過 RLS

        # 取得所有持股
        holdings_res = db.table("stock_holdings").select("*").execute()
        holdings = holdings_res.data or []

        if not holdings:
            print("[排程] 無持股資料")
            return

        # 取得所有股票的即時/收盤價
        symbols = list(set(h["symbol"] for h in holdings))
        tw_syms = [s for s in symbols if is_tw_stock(s)]
        us_syms = [s for s in symbols if not is_tw_stock(s)]

        price_map = {}
        if tw_syms:
            tw_prices = await get_tw_realtime(tw_syms)
            price_map.update(tw_prices)
            for s in tw_syms:
                if s not in price_map or price_map[s].get("error"):
                    fb = get_tw_fallback(s)
                    if not fb.get("error"):
                        price_map[s] = fb
        for s in us_syms:
            price_map[s] = get_us_price(s)

        # 依用戶分組計算損益
        from collections import defaultdict
        user_pnl = defaultdict(float)
        for h in holdings:
            uid = h["user_id"]
            sym = h["symbol"]
            p = price_map.get(sym, {})
            if p.get("error") or not p.get("price"):
                continue
            pnl = (p["price"] - float(h["avg_cost"])) * h["shares"]
            if h.get("is_short"):
                pnl = -pnl
            user_pnl[uid] += pnl

        # 存入日曆（upsert）
        for uid, pnl in user_pnl.items():
            db.table("calendar_records").upsert({
                "user_id": uid,
                "date": today,
                "unrealized_pnl": round(pnl, 2),
                "note": "系統自動記錄"
            }, on_conflict="user_id,date").execute()
            print(f"[排程] 用戶 {uid[:8]}... 今日損益 {pnl:+,.0f}")

        print(f"[排程] 完成，共記錄 {len(user_pnl)} 位用戶")
    except Exception as e:
        print(f"[排程] 錯誤: {e}")

@app.on_event("startup")
async def startup():
    asyncio.create_task(load_tw_stocks())
    # 每天 13:35 台灣時間自動記錄（收盤後5分鐘）
    scheduler.add_job(auto_record_pnl, "cron", hour=13, minute=35, day_of_week="mon-fri")
    scheduler.start()
    print("✅ 排程器已啟動，每日 13:35 自動記錄損益")

@app.get("/")
def root():
    return {"status": "ok", "stocks_loaded": len(_stock_cache)}

# ── 股票搜尋 ──────────────────────────────────────────
@app.get("/api/search")
def search_stocks(q: str = Query(..., min_length=1)):
    q_upper = q.strip().upper()
    results = []
    for s in _stock_cache:
        sym = s["symbol"].upper()
        name = s["name"] or ""
        if sym.startswith(q_upper) or q_upper in name or q_upper in sym:
            # 優先有名稱的結果
            results.append({"symbol": s["symbol"], "name": name})
        if len(results) >= 10:
            break

    # 如果搜不到或名稱為空，嘗試直接用 yfinance 查
    if len(results) == 0 and len(q_upper) >= 2:
        try:
            for suffix in ["", ".TW", ".TWO"]:
                t = yf.Ticker(q_upper + suffix)
                info = t.info
                name = info.get("longName") or info.get("shortName") or ""
                if name:
                    results.append({"symbol": q_upper, "name": name})
                    break
        except:
            pass
        # 至少返回代號本身
        if not results:
            results.append({"symbol": q_upper, "name": ""})

    return results

@app.get("/api/name/{symbol}")
def get_stock_name(symbol: str):
    """查詢單一股票名稱"""
    sym = symbol.upper()
    # 先查快取
    for s in _stock_cache:
        if s["symbol"].upper() == sym and s["name"]:
            return {"symbol": sym, "name": s["name"]}
    # 用 yfinance 查
    try:
        for suffix in ["", ".TW", ".TWO"]:
            t = yf.Ticker(sym + suffix)
            info = t.info
            name = info.get("longName") or info.get("shortName") or ""
            if name:
                return {"symbol": sym, "name": name}
    except:
        pass
    return {"symbol": sym, "name": ""}

# ── 台股即時報價（TWSE 官方 API）────────────────────────
async def get_tw_realtime(symbols: list[str]) -> dict:
    """
    使用台灣證交所 mis API 取得即時報價
    需要先取得 Session cookie 才能正確抓到資料
    """
    results = {}
    if not symbols:
        return results

    ex_ch = "|".join([f"tse_{s}.tw" for s in symbols])
    url = f"https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch={ex_ch}&json=1&delay=0"

    try:
        async with httpx.AsyncClient(timeout=10, verify=False) as client:
            # 先建立 Session（取得 cookie）
            await client.get(
                "https://mis.twse.com.tw/stock/index.jsp",
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            )
            res = await client.get(url, headers={
                "Referer": "https://mis.twse.com.tw/stock/index.jsp",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            })
            data = res.json()
            msgarray = data.get("msgArray", [])

            found_symbols = set()
            for item in msgarray:
                code = item.get("c", "")
                if not code:
                    continue
                found_symbols.add(code)
                try:
                    z = float(item.get("z", "0") or item.get("y", "0"))  # 成交價，無成交用昨收
                    y = float(item.get("y", "0"))   # 昨收
                    if z <= 0:
                        z = y
                    daily_change = round((z - y) / y * 100, 2) if y > 0 else 0
                    results[code] = {
                        "price": round(z, 2),
                        "daily_change": daily_change,
                        "weekly_change": None,
                        "monthly_change": None,
                        "ytd_change": None,
                        "source": "twse_realtime",
                    }
                except (ValueError, ZeroDivisionError):
                    pass

            # 上市查不到的改查上櫃
            missing = [s for s in symbols if s not in found_symbols]
            if missing:
                ex_ch2 = "|".join([f"otc_{s}.tw" for s in missing])
                url2 = f"https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch={ex_ch2}&json=1&delay=0"
                res2 = await client.get(url2, headers={"Referer": "https://mis.twse.com.tw/"})
                data2 = res2.json()
                for item in data2.get("msgArray", []):
                    code = item.get("c", "")
                    if not code:
                        continue
                    try:
                        z = float(item.get("z", "0") or item.get("y", "0"))
                        y = float(item.get("y", "0"))
                        if z <= 0:
                            z = y
                        daily_change = round((z - y) / y * 100, 2) if y > 0 else 0
                        results[code] = {
                            "price": round(z, 2),
                            "daily_change": daily_change,
                            "weekly_change": None,
                            "monthly_change": None,
                            "ytd_change": None,
                            "source": "tpex_realtime",
                        }
                    except (ValueError, ZeroDivisionError):
                        pass
    except Exception as e:
        print(f"台股即時報價錯誤: {e}")

    return results

# ── 台股備援：收盤後用 yfinance 抓昨收價 ─────────────
def get_tw_fallback(symbol: str) -> dict:
    try:
        hist = yf.Ticker(symbol + ".TW").history(period="5d")
        if hist.empty:
            hist = yf.Ticker(symbol + ".TWO").history(period="5d")
        if hist.empty:
            return {"error": "查無資料"}
        c = float(hist["Close"].iloc[-1])
        p = float(hist["Close"].iloc[-2]) if len(hist) > 1 else c
        return {
            "price": round(c, 2),
            "daily_change":   round((c - p) / p * 100, 2),
            "weekly_change":  None,
            "monthly_change": None,
            "ytd_change":     None,
            "source": "yfinance_delayed",
        }
    except:
        return {"error": "查無資料"}

# ── 美股報價（yfinance，有 15 分鐘延遲）────────────────
def get_us_price(symbol: str) -> dict:
    try:
        hist = yf.Ticker(symbol).history(period="1y")
        if hist.empty:
            return {"error": "查無資料"}
        c = float(hist["Close"].iloc[-1])
        p = float(hist["Close"].iloc[-2]) if len(hist) > 1 else c
        w = float(hist["Close"].iloc[-6]) if len(hist) > 5 else float(hist["Close"].iloc[0])
        m = float(hist["Close"].iloc[-22]) if len(hist) > 21 else float(hist["Close"].iloc[0])
        ys = float(hist["Close"].iloc[0])
        return {
            "price": round(c, 2),
            "daily_change":   round((c - p) / p * 100, 2),
            "weekly_change":  round((c - w) / w * 100, 2),
            "monthly_change": round((c - m) / m * 100, 2),
            "ytd_change":     round((c - ys) / ys * 100, 2),
            "source": "yfinance_delayed",
        }
    except Exception as e:
        return {"error": str(e)}

# ── 主要 prices API ───────────────────────────────────
@app.get("/api/prices")
async def get_prices(symbols: str = Query(...)):
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]

    tw_symbols = [s for s in symbol_list if is_tw_stock(s)]
    us_symbols = [s for s in symbol_list if not is_tw_stock(s)]

    results = {}

    # 台股：TWSE 即時價 + yfinance 補週/月/年漲跌
    if tw_symbols:
        # 1. 先用 TWSE 即時 API 抓當前價格
        tw_realtime = await get_tw_realtime(tw_symbols)

        # 2. 用 yfinance 抓歷史漲跌幅（跑在 thread pool 避免阻塞）
        import concurrent.futures
        def get_tw_history(symbol):
            try:
                for suffix in [".TW", ".TWO"]:
                    hist = yf.Ticker(symbol + suffix).history(period="1y")
                    if not hist.empty:
                        c = float(hist["Close"].iloc[-1])
                        p = float(hist["Close"].iloc[-2]) if len(hist) > 1 else c
                        w = float(hist["Close"].iloc[-6]) if len(hist) > 5 else float(hist["Close"].iloc[0])
                        m = float(hist["Close"].iloc[-22]) if len(hist) > 21 else float(hist["Close"].iloc[0])
                        ys = float(hist["Close"].iloc[0])
                        return symbol, {
                            "yf_price": round(c, 2),
                            "daily_change_yf": round((c - p) / p * 100, 2),
                            "weekly_change":   round((c - w) / w * 100, 2),
                            "monthly_change":  round((c - m) / m * 100, 2),
                            "ytd_change":      round((c - ys) / ys * 100, 2),
                        }
            except:
                pass
            return symbol, {}

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
            history_results = dict(ex.map(lambda s: get_tw_history(s), tw_symbols))

        # 3. 合併：即時價優先，沒有則用 yfinance 的價格
        for s in tw_symbols:
            rt = tw_realtime.get(s, {})
            hist = history_results.get(s, {})

            if rt.get("price"):
                # 有即時價：用 TWSE 的價格和日漲跌，補上 yfinance 的週/月/年
                results[s] = {
                    "price":           rt["price"],
                    "daily_change":    rt["daily_change"],
                    "weekly_change":   hist.get("weekly_change"),
                    "monthly_change":  hist.get("monthly_change"),
                    "ytd_change":      hist.get("ytd_change"),
                    "source":          rt.get("source", "twse_realtime"),
                }
            elif hist.get("yf_price"):
                # TWSE 抓不到（收盤後或特殊商品）→ 全用 yfinance
                results[s] = {
                    "price":          hist["yf_price"],
                    "daily_change":   hist["daily_change_yf"],
                    "weekly_change":  hist.get("weekly_change"),
                    "monthly_change": hist.get("monthly_change"),
                    "ytd_change":     hist.get("ytd_change"),
                    "source":         "twse_closed",
                }
            else:
                results[s] = {"error": "查無資料，可能為結構型商品"}

    # 美股：yfinance（含週/月/年）
    for s in us_symbols:
        results[s] = get_us_price(s)

    return results

# ── 台股歷史 K 線資料 ─────────────────────────────────
@app.get("/api/history/{symbol}")
def get_history(symbol: str, period: str = "5y"):
    yf_sym = symbol.upper()
    if is_tw_stock(yf_sym):
        for suffix in [".TW", ".TWO"]:
            try:
                hist = yf.Ticker(yf_sym + suffix).history(period=period)
                if not hist.empty:
                    break
            except:
                hist = None
    else:
        try:
            hist = yf.Ticker(yf_sym).history(period=period)
        except:
            return {"error": "查無資料"}

    if hist is None or hist.empty:
        return {"error": "查無資料"}

    closes = hist["Close"].tolist()
    
    # 計算 MA20, MA60
    def calc_ma(data, n):
        result = []
        for i in range(len(data)):
            if i < n - 1:
                result.append(None)
            else:
                result.append(round(sum(data[i-n+1:i+1]) / n, 2))
        return result

    ma20 = calc_ma(closes, 20)
    ma60 = calc_ma(closes, 60)

    # RSI14
    def calc_rsi(data, n=14):
        rsi = [None] * n
        gains, losses = [], []
        for i in range(1, len(data)):
            diff = data[i] - data[i-1]
            gains.append(max(diff, 0))
            losses.append(max(-diff, 0))
            if i >= n:
                avg_gain = sum(gains[-n:]) / n
                avg_loss = sum(losses[-n:]) / n
                if avg_loss == 0:
                    rsi.append(100)
                else:
                    rs = avg_gain / avg_loss
                    rsi.append(round(100 - 100 / (1 + rs), 2))
        return rsi

    rsi = calc_rsi(closes)

    # MACD
    def calc_ema(data, n):
        ema = [None] * (n - 1)
        k = 2 / (n + 1)
        first = sum(c for c in data[:n] if c is not None) / n
        ema.append(round(first, 4))
        for i in range(n, len(data)):
            ema.append(round(data[i] * k + ema[-1] * (1 - k), 4))
        return ema

    ema12 = calc_ema(closes, 12)
    ema26 = calc_ema(closes, 26)
    macd_line = [round(a - b, 4) if a and b else None for a, b in zip(ema12, ema26)]
    signal_valid = [x for x in macd_line if x is not None]
    signal = [None] * (len(macd_line) - len(signal_valid))
    signal += calc_ema(signal_valid, 9)
    histogram = [round(m - s, 4) if m and s else None for m, s in zip(macd_line, signal)]

    records = []
    for i, (idx, row) in enumerate(hist.iterrows()):
        records.append({
            "date":   str(idx.date()),
            "open":   round(float(row["Open"]), 2),
            "high":   round(float(row["High"]), 2),
            "low":    round(float(row["Low"]), 2),
            "close":  round(float(row["Close"]), 2),
            "volume": int(row["Volume"]),
            "ma20":   ma20[i],
            "ma60":   ma60[i],
            "rsi":    rsi[i] if i < len(rsi) else None,
            "macd":   macd_line[i] if i < len(macd_line) else None,
            "signal": signal[i] if i < len(signal) else None,
            "histogram": histogram[i] if i < len(histogram) else None,
        })

    return {"symbol": symbol, "period": period, "data": records}

# ── 台股籌碼分析（三大法人）────────────────────────────
@app.get("/api/chip/{symbol}")
async def get_chip_analysis(symbol: str):
    """取得三大法人近一個月買賣超資料"""
    import datetime
    results = []
    errors = []

    async with httpx.AsyncClient(timeout=15, verify=False) as client:
        # 抓近30天的資料（往前找有資料的交易日）
        today = datetime.date.today()
        checked = 0
        d = today
        while len(results) < 22 and checked < 45:  # 最多找45天，取約22個交易日
            date_str = d.strftime("%Y%m%d")
            try:
                res = await client.get(
                    f"https://www.twse.com.tw/rwd/zh/fund/T86?date={date_str}&selectType=ALLBUT0999&response=json",
                    headers={"Referer": "https://www.twse.com.tw/"}
                )
                json_data = res.json()
                if json_data.get("stat") == "OK":
                    rows = json_data.get("data", [])
                    row = next((r for r in rows if r[0].strip() == symbol.upper()), None)
                    if row:
                        results.append({
                            "date": f"{d.year}/{d.month:02d}/{d.day:02d}",
                            "foreign": int(row[4].replace(",","").replace("+","") if row[4].strip() else "0"),
                            "trust":   int(row[10].replace(",","").replace("+","") if row[10].strip() else "0"),
                            "dealer":  int(row[12].replace(",","").replace("+","") if row[12].strip() else "0"),
                            "total":   int(row[13].replace(",","").replace("+","") if row[13].strip() else "0"),
                        })
            except Exception as e:
                errors.append(str(e))
            d -= datetime.timedelta(days=1)
            checked += 1

    if not results:
        return {"error": "無法取得籌碼資料，可能尚未公布或非交易日", "symbol": symbol}

    # 計算統計
    foreign_sum = sum(r["foreign"] for r in results)
    trust_sum   = sum(r["trust"]   for r in results)
    dealer_sum  = sum(r["dealer"]  for r in results)
    total_sum   = sum(r["total"]   for r in results)

    # 連續買賣天數
    def streak(key):
        s = 0
        for r in results:
            if r[key] > 0: s += 1
            else: break
        return s
    def streak_sell(key):
        s = 0
        for r in results:
            if r[key] < 0: s += 1
            else: break
        return s

    # 外資持股比例（需另外抓）
    foreign_holding_pct = None
    try:
        async with httpx.AsyncClient(timeout=10, verify=False) as client:
            today_str = datetime.date.today().strftime("%Y%m%d")
            r = await client.get(
                f"https://www.twse.com.tw/rwd/zh/fund/MI_QSTNCK?date={today_str}&response=json",
                headers={"Referer": "https://www.twse.com.tw/"}
            )
            fdata = r.json()
            rows = fdata.get("data", [])
            row = next((x for x in rows if x[0].strip() == symbol.upper()), None)
            if row and len(row) > 5:
                foreign_holding_pct = row[5].strip()
    except:
        pass

    return {
        "symbol": symbol,
        "days": len(results),
        "daily": results,
        "summary": {
            "foreign_sum": foreign_sum,
            "trust_sum":   trust_sum,
            "dealer_sum":  dealer_sum,
            "total_sum":   total_sum,
            "foreign_holding_pct": foreign_holding_pct,
            "foreign_buy_days":  sum(1 for r in results if r["foreign"] > 0),
            "foreign_sell_days": sum(1 for r in results if r["foreign"] < 0),
            "trust_buy_days":    sum(1 for r in results if r["trust"] > 0),
            "trust_sell_days":   sum(1 for r in results if r["trust"] < 0),
        }
    }
