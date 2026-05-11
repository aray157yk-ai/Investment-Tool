import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, TrendingUp, TrendingDown, RefreshCw, ChevronRight, X, Check } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── AI 供應鏈產業資料 ─────────────────────────────────
const INDUSTRY_MAP = [
  {
    id: 'compute',
    name: '運算核心',
    en: 'Computing Core',
    desc: 'GPU / ASIC / HBM 記憶體',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.3)',
    stocks: [
      { symbol: '2330', name: '台積電', role: '先進製程 / CoWoS 封裝' },
      { symbol: '2454', name: '聯發科', role: 'AI 晶片設計 / 端側 AI' },
      { symbol: '2379', name: '瑞昱', role: '網路 IC / AI PC' },
      { symbol: '2303', name: '聯電', role: '成熟製程代工' },
      { symbol: '3711', name: '日月光投控', role: '封裝測試龍頭' },
    ]
  },
  {
    id: 'packaging',
    name: '封裝與互連',
    en: 'Packaging & Interconnect',
    desc: 'CoWoS / ABF 載板 / 玻璃基板',
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.3)',
    stocks: [
      { symbol: '2325', name: '矽品', role: 'CoWoS 封裝受益' },
      { symbol: '3037', name: '欣興電子', role: 'ABF 載板龍頭' },
      { symbol: '3006', name: '晶豪科', role: 'HBM 相關' },
      { symbol: '2049', name: '上銀', role: '精密機械 / 機器人' },
      { symbol: '6239', name: '力成', role: '記憶體封裝測試' },
    ]
  },
  {
    id: 'optical',
    name: '光傳輸',
    en: 'Optical Transmission',
    desc: 'CPO / 光模組 / 400G-800G',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.3)',
    stocks: [
      { symbol: '2345', name: '智邦', role: '400G/800G 交換器' },
      { symbol: '3017', name: '奇鋐', role: '散熱 + 光通訊' },
      { symbol: '6669', name: '緯穎', role: 'AI 伺服器 + 網路' },
      { symbol: '4958', name: '臻鼎', role: '高階 PCB' },
      { symbol: '3044', name: '健鼎', role: '伺服器用 PCB' },
    ]
  },
  {
    id: 'thermal',
    name: '散熱與電源',
    en: 'Thermal & Power',
    desc: '液冷系統 / 電源管理 / CDU',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.3)',
    stocks: [
      { symbol: '2308', name: '台達電', role: '電源管理 / 液冷龍頭' },
      { symbol: '3217', name: '雙鴻', role: '液冷散熱直接受益' },
      { symbol: '6230', name: '超眾', role: 'AI 伺服器散熱' },
      { symbol: '2421', name: '建準', role: '散熱風扇' },
      { symbol: '3036', name: '文曄', role: '散熱元件通路' },
    ]
  },
  {
    id: 'server',
    name: 'AI 伺服器',
    en: 'AI Server',
    desc: 'ODM / 系統整合 / GB200',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.3)',
    stocks: [
      { symbol: '2317', name: '鴻海', role: 'AI 伺服器 + GB200 NVL72' },
      { symbol: '2382', name: '廣達', role: 'NVIDIA 最大 AI 伺服器代工' },
      { symbol: '3231', name: '緯創', role: 'AI 伺服器 ODM' },
      { symbol: '2356', name: '英業達', role: '伺服器代工' },
      { symbol: '2324', name: '仁寶', role: '伺服器 + NB' },
    ]
  },
  {
    id: 'pcb',
    name: 'PCB 板',
    en: 'PCB',
    desc: '高階 PCB / AI 伺服器用板',
    color: '#ef4444',
    glow: 'rgba(239,68,68,0.3)',
    stocks: [
      { symbol: '2368', name: '金像電', role: 'AI 伺服器 PCB' },
      { symbol: '3034', name: '聯詠', role: 'OLED 驅動 IC' },
      { symbol: '8046', name: '南電', role: 'ABF 載板' },
      { symbol: '6669', name: '緯穎', role: 'AI 伺服器整合' },
      { symbol: '3045', name: '台灣大', role: '5G / AI 通訊' },
    ]
  },
  {
    id: 'etf',
    name: '主題 ETF',
    en: 'Theme ETF',
    desc: 'AI / 半導體 / 科技主題',
    color: '#f97316',
    glow: 'rgba(249,115,22,0.3)',
    stocks: [
      { symbol: '0050', name: '元大台灣50', role: '台灣前50大市值' },
      { symbol: '006208', name: '富邦台灣50', role: '類 0050，費用率低' },
      { symbol: '00891', name: '中信關鍵半導體', role: '半導體供應鏈' },
      { symbol: '00892', name: '富邦台灣半導體', role: '半導體主題' },
      { symbol: '00881', name: '國泰台灣5G+', role: '科技 + AI 主題' },
    ]
  },
]

// 漲跌格式化
const pct = (n) => n == null ? '—' : (n >= 0 ? '+' : '') + parseFloat(n).toFixed(2) + '%'
const pctColor = (n) => n == null ? 'text-gray-500' : n >= 0 ? 'text-green-400' : 'text-red-400'
const fmt = (n) => n == null ? '—' : parseFloat(n).toFixed(2)

export default function IndustryMap() {
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(false)
  const [selectedIndustry, setSelectedIndustry] = useState(null)
  const [addedStocks, setAddedStocks] = useState({}) // 記錄已加入的股票
  const [watchlistTabs, setWatchlistTabs] = useState([])
  const [showAddModal, setShowAddModal] = useState(null) // { symbol, name }
  const [selectedTab, setSelectedTab] = useState('')

  useEffect(() => {
    fetchAllPrices()
    fetchWatchlistTabs()
  }, [])

  const fetchAllPrices = async () => {
    setLoading(true)
    const allSymbols = [...new Set(INDUSTRY_MAP.flatMap(i => i.stocks.map(s => s.symbol)))].join(',')
    try {
      const res = await fetch(`${API}/api/prices?symbols=${allSymbols}`)
      const data = await res.json()
      setPrices(data)
    } catch (e) {
      console.error('無法取得股價')
    }
    setLoading(false)
  }

  const fetchWatchlistTabs = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('watchlist_tabs').select('*').eq('user_id', user.id).order('sort_order')
    setWatchlistTabs(data || [])
    if (data?.length > 0) setSelectedTab(data[0].id)
  }

  const addToWatchlist = async () => {
    if (!showAddModal || !selectedTab) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('watchlist_items').upsert({
      user_id: user.id,
      tab_id: selectedTab,
      symbol: showAddModal.symbol,
      name: showAddModal.name,
    }, { onConflict: 'user_id,tab_id,symbol' })
    setAddedStocks(prev => ({ ...prev, [showAddModal.symbol]: true }))
    setShowAddModal(null)
  }

  // 計算產業整體漲幅（加權平均）
  const getIndustryAvg = (industry) => {
    const vals = industry.stocks
      .map(s => prices[s.symbol]?.daily_change)
      .filter(v => v != null)
    if (!vals.length) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }

  return (
    <div className="h-full flex flex-col">
      {/* 標題列 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-semibold text-white">AI 產業地圖</h1>
          <p className="text-xs text-gray-500 mt-0.5">台灣 AI 供應鏈完整覆蓋</p>
        </div>
        <button onClick={fetchAllPrices} disabled={loading}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white border border-gray-700 px-3 py-2 rounded-lg text-sm transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '更新中' : '更新股價'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左側：產業列表 */}
        <div className="w-72 border-r border-gray-800 overflow-y-auto flex-shrink-0">
          {INDUSTRY_MAP.map(industry => {
            const avg = getIndustryAvg(industry)
            const isSelected = selectedIndustry?.id === industry.id
            return (
              <button key={industry.id}
                onClick={() => setSelectedIndustry(isSelected ? null : industry)}
                className={`w-full text-left px-4 py-3.5 border-b border-gray-800/50 transition-all ${
                  isSelected ? 'bg-gray-800' : 'hover:bg-gray-900'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: industry.color, boxShadow: `0 0 6px ${industry.glow}` }} />
                    <div>
                      <div className="text-sm font-medium text-white">{industry.name}</div>
                      <div className="text-xs text-gray-500">{industry.desc}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {avg != null && (
                      <span className={`text-xs font-medium ${pctColor(avg)}`}>{pct(avg)}</span>
                    )}
                    <ChevronRight className={`w-3.5 h-3.5 text-gray-600 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* 右側：股票列表 */}
        <div className="flex-1 overflow-y-auto">
          {!selectedIndustry ? (
            /* 未選擇時：顯示所有產業的概覽熱力圖 */
            <div className="p-6">
              <p className="text-gray-500 text-sm mb-4">點擊左側產業查看詳細股票，或瀏覽以下全覽</p>
              <div className="grid grid-cols-1 gap-4">
                {INDUSTRY_MAP.map(industry => {
                  const avg = getIndustryAvg(industry)
                  return (
                    <div key={industry.id}
                      className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden cursor-pointer hover:border-gray-700 transition-colors"
                      onClick={() => setSelectedIndustry(industry)}>
                      {/* 產業標題 */}
                      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between"
                        style={{ borderLeft: `3px solid ${industry.color}` }}>
                        <div>
                          <span className="text-sm font-semibold text-white">{industry.name}</span>
                          <span className="text-xs text-gray-500 ml-2">{industry.en}</span>
                        </div>
                        {avg != null && (
                          <div className={`flex items-center gap-1 text-sm font-bold ${pctColor(avg)}`}>
                            {avg >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {pct(avg)}
                          </div>
                        )}
                      </div>
                      {/* 股票列表 */}
                      <div className="grid grid-cols-5 divide-x divide-gray-800">
                        {industry.stocks.map(stock => {
                          const p = prices[stock.symbol]
                          return (
                            <div key={stock.symbol} className="px-3 py-2.5 text-center">
                              <div className="text-xs font-medium text-white">{stock.symbol}</div>
                              <div className="text-xs text-gray-500 truncate">{stock.name}</div>
                              {p?.price ? (
                                <>
                                  <div className="text-xs text-gray-300 mt-0.5">{fmt(p.price)}</div>
                                  <div className={`text-xs font-medium ${pctColor(p.daily_change)}`}>{pct(p.daily_change)}</div>
                                </>
                              ) : (
                                <div className="text-xs text-gray-700 mt-1">—</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* 選擇產業後：顯示詳細資訊 */
            <div className="p-6 space-y-4">
              {/* 產業標題 */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full"
                      style={{ background: selectedIndustry.color, boxShadow: `0 0 8px ${selectedIndustry.glow}` }} />
                    <h2 className="text-lg font-semibold text-white">{selectedIndustry.name}</h2>
                    <span className="text-sm text-gray-500">{selectedIndustry.en}</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1 ml-6">{selectedIndustry.desc}</p>
                </div>
                {(() => {
                  const avg = getIndustryAvg(selectedIndustry)
                  return avg != null ? (
                    <div className={`text-2xl font-bold ${pctColor(avg)}`}>{pct(avg)}</div>
                  ) : null
                })()}
              </div>

              {/* 股票卡片 */}
              <div className="space-y-2">
                {selectedIndustry.stocks.map(stock => {
                  const p = prices[stock.symbol]
                  const isAdded = addedStocks[stock.symbol]
                  return (
                    <div key={stock.symbol}
                      className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-gray-700 transition-colors">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{stock.symbol}</span>
                            <span className="text-gray-300 text-sm">{stock.name}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{stock.role}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        {/* 即時價格 */}
                        <div className="text-right">
                          <div className="text-white font-medium">
                            {p?.price ? fmt(p.price) : '—'}
                          </div>
                          <div className={`text-sm ${pctColor(p?.daily_change)}`}>
                            {pct(p?.daily_change)}
                          </div>
                        </div>

                        {/* 週漲跌 */}
                        <div className="text-right">
                          <div className="text-xs text-gray-500">週</div>
                          <div className={`text-sm ${pctColor(p?.weekly_change)}`}>
                            {pct(p?.weekly_change)}
                          </div>
                        </div>

                        {/* 月漲跌 */}
                        <div className="text-right">
                          <div className="text-xs text-gray-500">月</div>
                          <div className={`text-sm ${pctColor(p?.monthly_change)}`}>
                            {pct(p?.monthly_change)}
                          </div>
                        </div>

                        {/* 加入觀察清單 */}
                        <button
                          onClick={() => isAdded ? null : setShowAddModal({ symbol: stock.symbol, name: stock.name })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            isAdded
                              ? 'bg-green-900/30 text-green-400 border border-green-800'
                              : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700'
                          }`}>
                          {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          {isAdded ? '已加入' : '加入觀察'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 加入觀察清單 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">加入觀察清單</h3>
              <button onClick={() => setShowAddModal(null)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              將 <span className="text-white font-medium">{showAddModal.symbol} {showAddModal.name}</span> 加入到哪個分頁？
            </p>
            {watchlistTabs.length === 0 ? (
              <p className="text-gray-500 text-sm">請先在觀察清單建立分頁</p>
            ) : (
              <div className="space-y-2 mb-4">
                {watchlistTabs.map(tab => (
                  <button key={tab.id}
                    onClick={() => setSelectedTab(tab.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      selectedTab === tab.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}>
                    {tab.name}
                  </button>
                ))}
              </div>
            )}
            <button onClick={addToWatchlist}
              disabled={!selectedTab || watchlistTabs.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
              確認加入
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
