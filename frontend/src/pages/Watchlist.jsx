import { useState, useEffect, useRef } from 'react'
import StockSearch from '../components/StockSearch'
import TaiwanChart from '../components/TaiwanChart'
import { supabase } from '../lib/supabase'
import { Plus, X, Trash2, RefreshCw, ExternalLink, BarChart2, ChevronLeft } from 'lucide-react'

const pct = (n) => (n === undefined || n === null) ? '—' : (n >= 0 ? '+' : '') + parseFloat(n).toFixed(2) + '%'
const pctColor = (n) => (n === undefined || n === null) ? 'text-gray-500' : n >= 0 ? 'text-green-400' : 'text-red-400'
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── TradingView 圖表嵌入（iframe 穩定版）───────────────
const TV_SYMBOL_MAP = {
  '^TWII':  'TWSE:TAIEX',
  '^TWOII': 'TPEX:TPEX',
  '^DJI':   'DJ:DJI',
  '^GSPC':  'SP:SPX',
  '^IXIC':  'NASDAQ:COMP',
  'SPY':    'AMEX:SPY',
  'QQQ':    'NASDAQ:QQQ',
  'DIA':    'AMEX:DIA',
  'IWM':    'AMEX:IWM',
  'VTI':    'AMEX:VTI',
  'GLD':    'AMEX:GLD',
  'TLT':    'NASDAQ:TLT',
  'SLV':    'AMEX:SLV',
  'ES=F':   'CME_MINI:ES1!',
  'NQ=F':   'CME_MINI:NQ1!',
  'YM=F':   'CBOT_MINI:YM1!',
  'RTY=F':  'CME_MINI:RTY1!',
  'GC=F':   'COMEX:GC1!',
  'SI=F':   'COMEX:SI1!',
  'CL=F':   'NYMEX:CL1!',
  'NG=F':   'NYMEX:NG1!',
  'AAPL':   'NASDAQ:AAPL',
  'MSFT':   'NASDAQ:MSFT',
  'NVDA':   'NASDAQ:NVDA',
  'GOOGL':  'NASDAQ:GOOGL',
  'AMZN':   'NASDAQ:AMZN',
  'TSLA':   'NASDAQ:TSLA',
  'META':   'NASDAQ:META',
  'TSM':    'NYSE:TSM',
}

const toTVSymbol = (sym) => {
  if (!sym) return ''
  sym = sym.toUpperCase()
  if (TV_SYMBOL_MAP[sym]) return TV_SYMBOL_MAP[sym]
  if (/^[0-9]{4,6}[A-Z]?$/.test(sym)) return 'TWSE:' + sym
  return 'NASDAQ:' + sym
}

function TradingViewChart({ symbol }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !symbol) return
    containerRef.current.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: toTVSymbol(symbol),
      interval: 'D',
      timezone: 'Asia/Taipei',
      theme: 'dark',
      style: '1',
      locale: 'zh_TW',
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      save_image: true,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
    })

    const widget = document.createElement('div')
    widget.className = 'tradingview-widget-container__widget'
    widget.style.height = 'calc(100% - 32px)'
    widget.style.width = '100%'

    containerRef.current.appendChild(widget)
    containerRef.current.appendChild(script)

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [symbol])

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height: 'calc(100vh - 220px)', minHeight: '650px', width: '100%', display: 'flex', flexDirection: 'column' }}
    />
  )
}

// ── 籌碼分析（近一個月三大法人）──────────────────────
function ChipAnalysis({ symbol }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isTW = /^[0-9]{4,6}[A-Z]?$/.test(symbol?.toUpperCase() || '')

  useEffect(() => {
    if (symbol && isTW) fetchChip()
  }, [symbol])

  const fetchChip = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/chip/${symbol}`)
      const json = await res.json()
      if (json.error) { setError(json.error); setData(null) }
      else setData(json)
    } catch {
      setError('無法連線到後端')
    }
    setLoading(false)
  }

  if (!isTW) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center text-gray-500 text-sm">
      籌碼分析僅支援台股
    </div>
  )

  const fmtChip = (n) => {
    if (!n && n !== 0) return '—'
    const abs = Math.abs(n)
    const sign = n > 0 ? '+' : n < 0 ? '-' : ''
    if (abs >= 10000) return sign + (abs / 10000).toFixed(1) + '萬'
    if (abs >= 1000) return sign + (abs / 1000).toFixed(1) + 'K'
    return (n > 0 ? '+' : '') + n.toLocaleString()
  }
  const cc = (n) => (!n && n !== 0) ? 'text-gray-500' : n > 0 ? 'text-green-400' : n < 0 ? 'text-red-400' : 'text-gray-400'
  const s = data?.summary

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">
          三大法人籌碼分析
          {data && <span className="text-xs text-gray-500 ml-2">（近 {data.days} 個交易日）</span>}
        </h3>
        <button onClick={fetchChip} className="text-gray-500 hover:text-white transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && <div className="text-center text-gray-500 text-sm py-6">載入中，約需 10-20 秒...</div>}
      {error && <div className="text-center text-amber-500 text-sm py-4">{error}</div>}

      {!loading && s && (
        <>
          {s.foreign_holding_pct && (
            <div className="bg-gray-800 rounded-lg px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">外資持股比例</span>
              <span className="text-white font-bold">{s.foreign_holding_pct}%</span>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 mb-2">近一個月累積買賣超（張）</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '外資', value: s.foreign_sum },
                { label: '投信', value: s.trust_sum },
                { label: '自營商', value: s.dealer_sum },
                { label: '三大合計', value: s.total_sum },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">{label}</div>
                  <div className={`text-sm font-bold ${cc(value)}`}>{fmtChip(value)}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">買賣天數統計</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '外資', buy: s.foreign_buy_days, sell: s.foreign_sell_days },
                { label: '投信', buy: s.trust_buy_days, sell: s.trust_sell_days },
              ].map(({ label, buy, sell }) => (
                <div key={label} className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-2">{label}</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                      <div className="bg-green-500 h-1.5 rounded-full"
                        style={{ width: `${(buy / ((buy + sell) || 1)) * 100}%` }} />
                    </div>
                    <span className="text-xs text-green-400">{buy}買</span>
                    <span className="text-xs text-red-400">{sell}賣</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {data.daily?.length > 0 && (
            <details className="group">
              <summary className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer list-none flex items-center gap-1">
                <span className="group-open:hidden">▶</span>
                <span className="hidden group-open:inline">▼</span>
                查看每日明細
              </summary>
              <div className="mt-2 max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-600 border-b border-gray-800">
                      <th className="text-left py-1">日期</th>
                      <th className="text-right py-1">外資</th>
                      <th className="text-right py-1">投信</th>
                      <th className="text-right py-1">自營</th>
                      <th className="text-right py-1">合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((r, i) => (
                      <tr key={i} className="border-b border-gray-800/50">
                        <td className="py-1 text-gray-500">{r.date}</td>
                        <td className={`py-1 text-right ${cc(r.foreign)}`}>{fmtChip(r.foreign)}</td>
                        <td className={`py-1 text-right ${cc(r.trust)}`}>{fmtChip(r.trust)}</td>
                        <td className={`py-1 text-right ${cc(r.dealer)}`}>{fmtChip(r.dealer)}</td>
                        <td className={`py-1 text-right ${cc(r.total)}`}>{fmtChip(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
// ── 主頁面 ────────────────────────────────────────────
const isTWStock = (sym) => /^[0-9]{4,6}[A-Z]?$/.test((sym || '').toUpperCase())

const delayTag = (source) => {
  if (!source) return null
  if (source === 'yfinance_delayed') return <span className="text-xs bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded ml-1">延遲15分</span>
  return <span className="text-xs bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded ml-1">即時</span>
}

export default function Watchlist() {
  const [tabs, setTabs] = useState([])
  const [activeTab, setActiveTab] = useState(null)
  const [items, setItems] = useState([])
  const [prices, setPrices] = useState({})
  const [priceLoading, setPriceLoading] = useState(false)
  const [showAddTab, setShowAddTab] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newTabName, setNewTabName] = useState('')
  const [form, setForm] = useState({ symbol: '', name: '', note: '' })
  const [selectedStock, setSelectedStock] = useState(null) // 點擊後展開圖表

  useEffect(() => { fetchTabs() }, [])
  useEffect(() => { if (activeTab) { fetchItems(activeTab); setSelectedStock(null) } }, [activeTab])

  const fetchTabs = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('watchlist_tabs').select('*').eq('user_id', user.id).order('sort_order')
    setTabs(data || [])
    if (data?.length > 0 && !activeTab) setActiveTab(data[0].id)
  }

  const fetchItems = async (tabId) => {
    const { data } = await supabase.from('watchlist_items').select('*').eq('tab_id', tabId).order('created_at')
    setItems(data || [])
    if (data?.length > 0) fetchPrices(data)
  }

  const fetchPrices = async (itemList) => {
    if (!itemList?.length) return
    setPriceLoading(true)
    const symbols = [...new Set(itemList.map(i => i.symbol))].join(',')
    try {
      const res = await fetch(`${API}/api/prices?symbols=${symbols}`)
      const data = await res.json()
      setPrices(data)
    } catch (e) { console.error('後端未啟動') }
    setPriceLoading(false)
  }

  const addTab = async () => {
    if (!newTabName || tabs.length >= 10) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('watchlist_tabs').insert({ user_id: user.id, name: newTabName, sort_order: tabs.length }).select().single()
    setNewTabName(''); setShowAddTab(false); fetchTabs()
    if (data) setActiveTab(data.id)
  }

  const deleteTab = async (id) => {
    if (!confirm('確定刪除此分頁？')) return
    await supabase.from('watchlist_tabs').delete().eq('id', id)
    setActiveTab(null); setItems([]); setPrices({}); setSelectedStock(null); fetchTabs()
  }

  const addItem = async () => {
    if (!form.symbol || !activeTab) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('watchlist_items').insert({
      user_id: user.id, tab_id: activeTab,
      symbol: form.symbol.toUpperCase(), name: form.name, note: form.note
    })
    setForm({ symbol: '', name: '', note: '' }); setShowAddItem(false)
    fetchItems(activeTab)
  }

  const deleteItem = async (id) => {
    await supabase.from('watchlist_items').delete().eq('id', id)
    if (selectedStock?.id === id) setSelectedStock(null)
    fetchItems(activeTab)
  }

  const getYFLink = (symbol) => `https://finance.yahoo.com/quote/${symbol.match(/^\d{4,6}[A-Z]?$/) ? symbol + '.TW' : symbol}`

  // ── 圖表展開頁面 ────────────────────────────────────
  if (selectedStock) {
    const p = prices[selectedStock.symbol]
    const isLoadingPrice = priceLoading && !p
    return (
      <div className="p-6 space-y-4">
        {/* 返回按鈕 */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedStock(null)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">返回觀察清單</span>
          </button>
          <div className="h-4 w-px bg-gray-700" />
          <div>
            <span className="text-white font-semibold text-lg">{selectedStock.symbol}</span>
            {selectedStock.name && <span className="text-gray-400 ml-2">{selectedStock.name}</span>}
          </div>
          <div className="ml-auto flex items-center gap-3">
            {isLoadingPrice ? (
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 bg-gray-800 rounded animate-pulse" />
                <div className="h-5 w-16 bg-gray-800 rounded animate-pulse" />
              </div>
            ) : p?.price ? (
              <>
                {delayTag(p.source)}
                <span className="text-white text-xl font-bold">{p.price.toFixed(2)}</span>
                <span className={`text-sm font-medium ${p.daily_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pct(p.daily_change)}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {/* 圖表：台股用 TaiwanChart，美股用 TradingView */}
        {isTWStock(selectedStock.symbol) ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-500">K線 · MA20/MA60 · 水平線 · 趨勢線 · 矩形</span>
              <a href={getYFLink(selectedStock.symbol)} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition-colors">
                Yahoo Finance <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="p-3 pb-2">
              <TaiwanChart symbol={selectedStock.symbol} />
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-500">技術分析 · 左側工具列可畫趨勢線 · 自動儲存</span>
              <a href={getYFLink(selectedStock.symbol)} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition-colors">
                Yahoo Finance <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <TradingViewChart symbol={selectedStock.symbol} />
          </div>
        )}

        {/* 多週期漲跌 */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '日漲跌', key: 'daily_change' },
            { label: '週漲跌', key: 'weekly_change' },
            { label: '月漲跌', key: 'monthly_change' },
            { label: '今年漲跌', key: 'ytd_change' },
          ].map(({ label, key }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              {isLoadingPrice ? (
                <div className="h-6 bg-gray-800 rounded animate-pulse mx-2" />
              ) : p && !p.error ? (
                <div className={`text-lg font-bold ${pctColor(p[key])}`}>{pct(p[key])}</div>
              ) : (
                <div className="text-gray-600 text-sm">—</div>
              )}
            </div>
          ))}
        </div>

        {/* 籌碼分析 */}
        <ChipAnalysis symbol={selectedStock.symbol} />

        {/* 備註 */}
        {selectedStock.note && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">觀察備註</p>
            <p className="text-sm text-gray-300">{selectedStock.note}</p>
          </div>
        )}
      </div>
    )
  }

  // ── 清單主畫面 ───────────────────────────────────────
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">觀察清單</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchPrices(items)} disabled={priceLoading || !items.length}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white border border-gray-700 px-3 py-2 rounded-lg text-sm transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${priceLoading ? 'animate-spin' : ''}`} />
            {priceLoading ? '更新中' : '更新股價'}
          </button>
          <button onClick={() => setShowAddItem(true)} disabled={!activeTab}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            <Plus className="w-4 h-4" /> 新增股票
          </button>
        </div>
      </div>

      {/* 分頁 */}
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map(tab => (
          <div key={tab.id} className="flex items-center shrink-0">
            <button onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {tab.name}
            </button>
            <button onClick={() => deleteTab(tab.id)} className="ml-1 text-gray-600 hover:text-red-400 p-0.5"><X className="w-3 h-3" /></button>
          </div>
        ))}
        {tabs.length < 10 && (showAddTab ? (
          <div className="flex items-center gap-2">
            <input autoFocus value={newTabName} onChange={e => setNewTabName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTab()}
              placeholder="分頁名稱" className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 w-28" />
            <button onClick={addTab} className="text-blue-400 text-sm">確定</button>
            <button onClick={() => setShowAddTab(false)} className="text-gray-500 text-sm">取消</button>
          </div>
        ) : (
          <button onClick={() => setShowAddTab(true)}
            className="flex items-center gap-1 text-gray-500 hover:text-white text-sm px-2 py-1.5 transition-colors">
            <Plus className="w-3.5 h-3.5" /> 新增分頁
          </button>
        ))}
      </div>

      {/* 股票清單 */}
      {tabs.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-500">請先新增一個分頁</div>
      ) : items.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-500">此分頁尚無股票，點右上角新增</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800 text-left">
                <th className="px-4 py-3">股票</th>
                <th className="px-4 py-3 text-right">現價</th>
                <th className="px-4 py-3 text-right">日漲跌</th>
                <th className="px-4 py-3 text-right">週漲跌</th>
                <th className="px-4 py-3 text-right">月漲跌</th>
                <th className="px-4 py-3 text-right">今年漲跌</th>
                <th className="px-4 py-3">備註</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {items.map(item => {
                const p = prices[item.symbol]
                return (
                  <tr key={item.id}
                    className="hover:bg-gray-800/40 cursor-pointer"
                    onClick={() => setSelectedStock(item)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <span className="font-medium text-white">{item.symbol}</span>
                          {item.name && <span className="text-gray-500 text-xs ml-1.5">{item.name}</span>}
                        </div>
                        <BarChart2 className="w-3.5 h-3.5 text-gray-600" />
                        <a href={getYFLink(item.symbol)} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-gray-600 hover:text-blue-400 transition-colors">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p?.source && delayTag(p.source)}
                        <span className="text-white">{p?.price ? p.price.toFixed(2) : '—'}</span>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${pctColor(p?.daily_change)}`}>{pct(p?.daily_change)}</td>
                    <td className={`px-4 py-3 text-right ${pctColor(p?.weekly_change)}`}>{pct(p?.weekly_change)}</td>
                    <td className={`px-4 py-3 text-right ${pctColor(p?.monthly_change)}`}>{pct(p?.monthly_change)}</td>
                    <td className={`px-4 py-3 text-right ${pctColor(p?.ytd_change)}`}>{pct(p?.ytd_change)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{item.note || '—'}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => deleteItem(item.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 新增 Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">新增觀察股票</h3>
              <button onClick={() => setShowAddItem(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">股票代號 *（輸入代號或名稱搜尋）</label>
                <StockSearch
                  value={form.symbol}
                  onChange={(symbol, name) => setForm(p => ({ ...p, symbol, name: name || p.name }))}
                  placeholder="2330、台積電、SPY、ES=F"
                />
                {form.name && <p className="text-xs text-blue-400 mt-1 pl-1">{form.symbol} — {form.name}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">備註</label>
                <input type="text" value={form.note}
                  onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                  placeholder="觀察原因..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                <p>台股：輸入代號如 2330、0050</p>
                <p>美股期貨：ES=F（S&P）、NQ=F（那指）、YM=F（道瓊）</p>
                <p>指數：^TWII（加權）、^TWOII（櫃買）</p>
              </div>
              <button onClick={addItem}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                新增
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
