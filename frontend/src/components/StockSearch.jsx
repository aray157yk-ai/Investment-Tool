import { useState, useEffect, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'

const API = 'http://localhost:8000'

// 常用台股靜態名稱庫（後端載入失敗時的備援）
const STATIC_TW_STOCKS = [
  // 半導體
  { symbol: '2330', name: '台積電' },
  { symbol: '2303', name: '聯電' },
  { symbol: '2454', name: '聯發科' },
  { symbol: '2379', name: '瑞昱' },
  { symbol: '3711', name: '日月光投控' },
  { symbol: '2325', name: '矽品' },
  { symbol: '3037', name: '欣興電子' },
  { symbol: '2344', name: '華邦電' },
  { symbol: '3034', name: '聯詠' },
  { symbol: '2408', name: '南亞科' },
  { symbol: '4919', name: '新唐' },
  { symbol: '6770', name: '力積電' },
  // AI 伺服器
  { symbol: '2317', name: '鴻海' },
  { symbol: '2382', name: '廣達' },
  { symbol: '3231', name: '緯創' },
  { symbol: '2356', name: '英業達' },
  { symbol: '2324', name: '仁寶' },
  { symbol: '6669', name: '緯穎' },
  { symbol: '3017', name: '奇鋐' },
  // 散熱電源
  { symbol: '2308', name: '台達電' },
  { symbol: '3217', name: '雙鴻' },
  { symbol: '6230', name: '超眾' },
  { symbol: '2421', name: '建準' },
  { symbol: '3036', name: '文曄' },
  // 光通訊
  { symbol: '2345', name: '智邦' },
  // PCB
  { symbol: '4958', name: '臻鼎' },
  { symbol: '3044', name: '健鼎' },
  { symbol: '2368', name: '金像電' },
  // 金融
  { symbol: '2882', name: '國泰金' },
  { symbol: '2881', name: '富邦金' },
  { symbol: '2886', name: '兆豐金' },
  { symbol: '2884', name: '玉山金' },
  { symbol: '2885', name: '元大金' },
  { symbol: '2891', name: '中信金' },
  { symbol: '2892', name: '第一金' },
  { symbol: '2880', name: '華南金' },
  { symbol: '2887', name: '台新金' },
  { symbol: '2888', name: '新光金' },
  { symbol: '2890', name: '永豐金' },
  { symbol: '5880', name: '合庫金' },
  // 電信
  { symbol: '2412', name: '中華電' },
  { symbol: '4904', name: '遠傳' },
  { symbol: '3045', name: '台灣大' },
  // ETF
  { symbol: '0050', name: '元大台灣50' },
  { symbol: '0051', name: '元大中型100' },
  { symbol: '0052', name: '富邦科技' },
  { symbol: '0056', name: '元大高股息' },
  { symbol: '006205', name: '富邦上証' },
  { symbol: '006208', name: '富邦台50' },
  { symbol: '00631L', name: '元大台灣50正2' },
  { symbol: '00632R', name: '元大台灣50反1' },
  { symbol: '00646', name: '元大S&P500' },
  { symbol: '00665L', name: '富邦恒生正2' },
  { symbol: '00675L', name: '富邦臺灣加權正2' },
  { symbol: '00680L', name: '元大美債20正2' },
  { symbol: '00681B', name: '元大美債20年' },
  { symbol: '00690', name: '兆豐藍籌30' },
  { symbol: '00692', name: '富邦公司債' },
  { symbol: '00701', name: '國泰標普低波高息' },
  { symbol: '00713', name: '元大台灣高息低波' },
  { symbol: '00719B', name: '元大美債1-3' },
  { symbol: '00720B', name: '元大投資級公司債' },
  { symbol: '00733', name: '富邦臺灣中小' },
  { symbol: '00757', name: '統一FANG+' },
  { symbol: '00762', name: '元大全球AI' },
  { symbol: '00830', name: '國泰費城半導體' },
  { symbol: '00878', name: '國泰永續高股息' },
  { symbol: '00881', name: '國泰台灣5G+' },
  { symbol: '00882', name: '中信中國高股息' },
  { symbol: '00891', name: '中信關鍵半導體' },
  { symbol: '00892', name: '富邦台灣半導體' },
  { symbol: '00893', name: '國泰智能電動車' },
  { symbol: '00896', name: '中信小資高息60' },
  { symbol: '00900', name: '富邦特選高股息30' },
  { symbol: '00905', name: '華南永昌台灣智選' },
  { symbol: '00907', name: '永豐優息存股' },
  { symbol: '00910', name: '第一金太空衛星' },
  { symbol: '00911', name: '兆豐台灣晶圓製造' },
  { symbol: '00912', name: '中信臺灣智慧50' },
  { symbol: '00915', name: '凱基優選高股息30' },
  { symbol: '00916', name: '國泰全球品牌50' },
  { symbol: '00918', name: '大華優利高填息30' },
  { symbol: '00919', name: '群益台灣精選高息' },
  { symbol: '00921', name: '兆豐龍頭等權重' },
  { symbol: '00922', name: '國泰台灣領袖50' },
  { symbol: '00923', name: '群益台科半導體收益' },
  { symbol: '00929', name: '復華台灣科技優息' },
  { symbol: '00930', name: '永豐台灣ESG' },
  { symbol: '00934', name: '中信成長高股息' },
  { symbol: '00936', name: '台新臺灣IC設計動能' },
  { symbol: '00939', name: '統一台灣高息動能' },
  { symbol: '00940', name: '元大台灣價值高息' },
  { symbol: '00941', name: '中信上游半導體' },
  { symbol: '00950', name: '愛投資台灣高息成長' },
  { symbol: '00981A', name: '主動統一台股增長' },
  // 傳產
  { symbol: '2002', name: '中鋼' },
  { symbol: '1301', name: '台塑' },
  { symbol: '1303', name: '南亞' },
  { symbol: '1326', name: '台化' },
  { symbol: '6505', name: '台塑化' },
  { symbol: '2207', name: '和泰車' },
  { symbol: '2801', name: '彰銀' },
  { symbol: '2912', name: '統一超' },
  { symbol: '2327', name: '國巨' },
  { symbol: '3008', name: '大立光' },
]

// 美股/期貨靜態庫
const STATIC_US = [
  { symbol: 'SPY',   name: 'S&P 500 ETF' },
  { symbol: 'QQQ',   name: 'Nasdaq 100 ETF' },
  { symbol: 'DIA',   name: 'Dow Jones ETF' },
  { symbol: 'IWM',   name: 'Russell 2000 ETF' },
  { symbol: 'VTI',   name: 'Vanguard Total Market' },
  { symbol: 'GLD',   name: '黃金 ETF' },
  { symbol: 'TLT',   name: '美國長債 ETF' },
  { symbol: 'AAPL',  name: 'Apple' },
  { symbol: 'MSFT',  name: 'Microsoft' },
  { symbol: 'NVDA',  name: 'NVIDIA' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'AMZN',  name: 'Amazon' },
  { symbol: 'TSLA',  name: 'Tesla' },
  { symbol: 'META',  name: 'Meta' },
  { symbol: 'TSM',   name: '台積電 ADR' },
  { symbol: 'ES=F',  name: 'S&P 500 期貨（美股夜盤）' },
  { symbol: 'NQ=F',  name: 'Nasdaq 100 期貨（美股夜盤）' },
  { symbol: 'YM=F',  name: '道瓊期貨（美股夜盤）' },
  { symbol: 'GC=F',  name: '黃金期貨' },
  { symbol: 'CL=F',  name: '原油期貨（WTI）' },
  { symbol: 'SI=F',  name: '白銀期貨' },
  { symbol: 'NG=F',  name: '天然氣期貨' },
  { symbol: '^TWII', name: '台灣加權指數' },
  { symbol: '^TWOII',name: '台灣櫃買指數' },
  { symbol: '^DJI',  name: '道瓊工業指數' },
  { symbol: '^GSPC', name: 'S&P 500 指數' },
  { symbol: '^IXIC', name: '那斯達克指數' },
  { symbol: '^HSI',  name: '恒生指數' },
  { symbol: '^N225', name: '日經225指數' },
]

const ALL_STATIC = [...STATIC_TW_STOCKS, ...STATIC_US]

// 本地搜尋（不需要後端）
function localSearch(q) {
  if (!q) return []
  const upper = q.toUpperCase()
  const results = []
  for (const s of ALL_STATIC) {
    if (s.symbol.toUpperCase().startsWith(upper) || s.name.includes(q)) {
      results.push(s)
      if (results.length >= 10) break
    }
  }
  return results
}

export default function StockSearch({ value, onChange, placeholder = '輸入代號或名稱', disabled }) {
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const timerRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { setQuery(value || '') }, [value])

  const search = async (q) => {
    if (!q || q.length < 1) { setResults([]); setOpen(false); return }

    // 先用本地靜態庫立即顯示結果
    const localResults = localSearch(q)
    setResults(localResults)
    if (localResults.length > 0) setOpen(true)

    // 同時呼叫後端取得完整清單
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        // 合併後端結果：後端有名稱的優先，補上本地靜態庫沒有的
        const merged = [...data]
        for (const local of localResults) {
          if (!merged.find(d => d.symbol === local.symbol)) {
            merged.push(local)
          } else {
            // 後端有該代號但名稱是空的，用靜態庫的名稱補上
            const idx = merged.findIndex(d => d.symbol === local.symbol)
            if (!merged[idx].name || merged[idx].name.length < 2) {
              merged[idx].name = local.name
            }
          }
        }
        setResults(merged.slice(0, 10))
        setOpen(true)
      }
    } catch (e) {
      // 後端失敗，繼續用本地結果
    }
    setLoading(false)
    setActiveIdx(0)
  }

  const handleInput = (e) => {
    const q = e.target.value
    setQuery(q)
    onChange(q.toUpperCase(), '')
    clearTimeout(timerRef.current)
    if (q.length >= 1) {
      timerRef.current = setTimeout(() => search(q), 150)
    } else {
      setResults([]); setOpen(false)
    }
  }

  const select = (item) => {
    setQuery(item.symbol)
    onChange(item.symbol, item.name)
    setOpen(false)
    setResults([])
  }

  const handleKeyDown = (e) => {
    if (!open || !results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); if (results[activeIdx]) select(results[activeIdx]) }
    if (e.key === 'Escape')    { setOpen(false) }
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => query && results.length && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
          autoComplete="off"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 animate-spin" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {results.map((item, i) => (
            <button key={item.symbol} onMouseDown={() => select(item)} onMouseEnter={() => setActiveIdx(i)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors text-left ${
                i === activeIdx ? 'bg-blue-600 text-white' : 'text-gray-200 hover:bg-gray-700'
              }`}>
              <span className="font-medium shrink-0">{item.symbol}</span>
              <span className={`text-xs ml-3 truncate ${i === activeIdx ? 'text-blue-200' : 'text-gray-400'}`}>
                {item.name || '—'}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && !loading && query.length >= 1 && results.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-500">
          找不到符合結果，可直接輸入代號確認
        </div>
      )}
    </div>
  )
}
