import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, RefreshCw, ChevronDown, ChevronUp, Heart, Check, X } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── 完整 AI 供應鏈資料 ────────────────────────────────
const SUPPLY_CHAIN = [
  {
    tier: 'UPSTREAM',
    label: '上游',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.3)',
    categories: [
      {
        name: '矽智財授權（IP）',
        desc: '提供晶片設計所需的基礎 IP 核心，包含記憶體、介面、CPU 等',
        subcategories: [
          {
            name: '記憶體與安全 IP',
            desc: '嵌入式非揮發性記憶體（eNVM）、安全 IP 與生物辨識設計服務',
            stocks: [
              { symbol: '3529', name: '力旺', role: '產業龍頭', level: '高關聯度', note: 'eNVM IP 全球市佔第一' },
              { symbol: '6423', name: '億而得-創', role: '利基專精', level: '高關聯度', note: '安全 IP 設計' },
            ]
          },
          {
            name: '介面與 CPU IP',
            desc: 'PCIe、USB、SerDes 高速介面 IP 以及 RISC-V CPU 核心 IP',
            stocks: [
              { symbol: '6533', name: '晶心科', role: '利基專精', level: '高關聯度', note: 'RISC-V CPU IP 設計' },
              { symbol: '6643', name: 'M31', role: '利基專精', level: '高關聯度', note: '高速介面 IP' },
            ]
          },
        ]
      },
      {
        name: '晶片設計（Fabless）',
        desc: '無晶圓廠的 IC 設計公司，專注於 AI、HPC、網路等晶片研發',
        subcategories: [
          {
            name: 'AI / HPC 晶片',
            desc: '人工智慧與高效能運算專用晶片設計',
            stocks: [
              { symbol: '2454', name: '聯發科', role: '產業龍頭', level: '高關聯度', note: 'AI 晶片設計 / 端側 AI' },
              { symbol: '2379', name: '瑞昱', role: '產業龍頭', level: '高關聯度', note: '網路 IC / AI PC' },
              { symbol: '3034', name: '聯詠', role: '利基專精', level: '中關聯度', note: 'OLED 驅動 IC' },
            ]
          },
          {
            name: '網路 / 交換器 IC',
            desc: '資料中心高速網路交換晶片',
            stocks: [
              { symbol: '4966', name: '譜瑞-KY', role: '利基專精', level: '高關聯度', note: 'PCIe / DisplayPort 介面 IC' },
              { symbol: '3515', name: '華擎', role: '利基專精', level: '中關聯度', note: '伺服器主機板' },
            ]
          },
        ]
      },
      {
        name: '晶圓代工（Foundry）',
        desc: '提供晶片製造服務，是整個半導體產業的關鍵基礎',
        subcategories: [
          {
            name: '先進製程',
            desc: '3nm / 5nm / 7nm 等先進節點製造，CoWoS 先進封裝',
            stocks: [
              { symbol: '2330', name: '台積電', role: '產業龍頭', level: '高關聯度', note: '先進製程 + CoWoS 封裝全球唯一' },
            ]
          },
          {
            name: '成熟製程',
            desc: '28nm 以上成熟節點，車用 / 工業用晶片',
            stocks: [
              { symbol: '2303', name: '聯電', role: '產業龍頭', level: '中關聯度', note: '成熟製程代工' },
              { symbol: '5347', name: '世界先進', role: '利基專精', level: '中關聯度', note: '類比 IC 代工' },
            ]
          },
        ]
      },
    ]
  },
  {
    tier: 'MIDSTREAM',
    label: '中游',
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.3)',
    categories: [
      {
        name: '先進封裝（OSAT）',
        desc: '將晶片與電路整合為最終產品，CoWoS / SoIC 為 AI 關鍵技術',
        subcategories: [
          {
            name: 'CoWoS / 先進封裝',
            desc: '高頻寬記憶體與 AI 晶片的整合封裝技術',
            stocks: [
              { symbol: '3711', name: '日月光投控', role: '產業龍頭', level: '高關聯度', note: '全球最大封測廠' },
              { symbol: '2325', name: '矽品', role: '產業龍頭', level: '高關聯度', note: 'CoWoS 封裝受益' },
              { symbol: '6239', name: '力成', role: '利基專精', level: '高關聯度', note: '記憶體封裝測試' },
            ]
          },
          {
            name: 'ABF / 玻璃載板',
            desc: '高端 IC 封裝用基板，AI 晶片需求大幅拉升',
            stocks: [
              { symbol: '3037', name: '欣興電子', role: '產業龍頭', level: '高關聯度', note: 'ABF 載板龍頭' },
              { symbol: '8046', name: '南電', role: '利基專精', level: '高關聯度', note: 'ABF 載板' },
              { symbol: '3006', name: '晶豪科', role: '利基專精', level: '高關聯度', note: 'HBM 相關記憶體' },
            ]
          },
        ]
      },
      {
        name: '散熱系統',
        desc: 'AI 運算產生大量熱能，散熱是高效能伺服器的關鍵限制因素',
        subcategories: [
          {
            name: '液冷系統',
            desc: '直接液冷（DLC）/ 浸沒式液冷，替代傳統風冷',
            stocks: [
              { symbol: '3217', name: '雙鴻', role: '產業龍頭', level: '高關聯度', note: '液冷散熱直接受益' },
              { symbol: '6230', name: '超眾', role: '利基專精', level: '高關聯度', note: 'AI 伺服器散熱' },
              { symbol: '3017', name: '奇鋐', role: '利基專精', level: '高關聯度', note: '散熱模組 + 光通訊' },
            ]
          },
          {
            name: '風冷 / 散熱模組',
            desc: '傳統風冷散熱，仍是大量伺服器的標準配置',
            stocks: [
              { symbol: '2421', name: '建準', role: '利基專精', level: '中關聯度', note: '散熱風扇龍頭' },
              { symbol: '1590', name: '亞德客-KY', role: '利基專精', level: '中關聯度', note: '氣動元件' },
            ]
          },
        ]
      },
      {
        name: '電源管理',
        desc: '高效能 AI 伺服器需要精密電源管理，確保穩定供電與節能',
        subcategories: [
          {
            name: '電源供應 / UPS',
            desc: '伺服器電源供應器（PSU）與不斷電系統',
            stocks: [
              { symbol: '2308', name: '台達電', role: '產業龍頭', level: '高關聯度', note: '電源管理 + 液冷系統龍頭' },
              { symbol: '6409', name: '旭隼', role: '利基專精', level: '高關聯度', note: '電源模組' },
            ]
          },
        ]
      },
      {
        name: 'PCB 印刷電路板',
        desc: '連接所有電子元件的基礎，AI 伺服器需要高層數高速 PCB',
        subcategories: [
          {
            name: 'AI 伺服器用 PCB',
            desc: '高層數、高頻高速 PCB，支援 400G/800G 傳輸',
            stocks: [
              { symbol: '4958', name: '臻鼎', role: '產業龍頭', level: '高關聯度', note: '高階 PCB 龍頭' },
              { symbol: '3044', name: '健鼎', role: '利基專精', level: '高關聯度', note: '伺服器用 PCB' },
              { symbol: '2368', name: '金像電', role: '利基專精', level: '高關聯度', note: 'AI 伺服器 PCB' },
            ]
          },
        ]
      },
    ]
  },
  {
    tier: 'DOWNSTREAM',
    label: '下游',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.3)',
    categories: [
      {
        name: 'AI 伺服器 ODM',
        desc: '整合所有零組件，為 NVIDIA / AMD 等大廠代工組裝 AI 伺服器',
        subcategories: [
          {
            name: 'GB200 / NVL72 供應商',
            desc: 'NVIDIA 新一代 AI 伺服器平台的代工廠商',
            stocks: [
              { symbol: '2317', name: '鴻海', role: '產業龍頭', level: '高關聯度', note: 'GB200 NVL72 主要代工' },
              { symbol: '2382', name: '廣達', role: '產業龍頭', level: '高關聯度', note: 'NVIDIA 最大 AI 伺服器代工' },
              { symbol: '3231', name: '緯創', role: '產業龍頭', level: '高關聯度', note: 'AI 伺服器 ODM' },
              { symbol: '2356', name: '英業達', role: '利基專精', level: '高關聯度', note: '伺服器代工' },
              { symbol: '2324', name: '仁寶', role: '利基專精', level: '中關聯度', note: '伺服器 + 筆電' },
            ]
          },
          {
            name: '機架式 / 儲存伺服器',
            desc: '資料中心用儲存與運算伺服器',
            stocks: [
              { symbol: '6669', name: '緯穎', role: '利基專精', level: '高關聯度', note: 'AI 伺服器 + 網路' },
              { symbol: '3515', name: '華擎', role: '利基專精', name2: '華擎', level: '中關聯度', note: '伺服器主機板' },
            ]
          },
        ]
      },
      {
        name: '網路設備',
        desc: '連接 AI 伺服器叢集的高速網路交換器與相關設備',
        subcategories: [
          {
            name: '400G / 800G 交換器',
            desc: 'AI 資料中心內部高速互連網路設備',
            stocks: [
              { symbol: '2345', name: '智邦', role: '產業龍頭', level: '高關聯度', note: '400G/800G 交換器龍頭' },
              { symbol: '4924', name: '炎洲', role: '利基專精', level: '中關聯度', note: '電纜 / 線材' },
            ]
          },
        ]
      },
      {
        name: '主題 ETF',
        desc: '以 AI / 半導體 / 科技為主題的台灣 ETF，適合分散投資',
        subcategories: [
          {
            name: 'AI / 科技主題 ETF',
            desc: '追蹤 AI 相關台股指數的 ETF',
            stocks: [
              { symbol: '0050', name: '元大台灣50', role: '大盤代表', level: '中關聯度', note: '台灣前50大市值' },
              { symbol: '006208', name: '富邦台灣50', role: '大盤代表', level: '中關聯度', note: '類 0050，費用率低' },
              { symbol: '00891', name: '中信關鍵半導體', role: '主題 ETF', level: '高關聯度', note: '半導體供應鏈' },
              { symbol: '00892', name: '富邦台灣半導體', role: '主題 ETF', level: '高關聯度', note: '半導體主題' },
              { symbol: '00881', name: '國泰台灣5G+', role: '主題 ETF', level: '中關聯度', note: '科技 + AI 主題' },
            ]
          },
        ]
      },
    ]
  },
]

// ── 樣式 ─────────────────────────────────────────────
const ROLE_STYLE = {
  '產業龍頭': 'bg-green-900/50 text-green-400 border border-green-700',
  '利基專精': 'bg-blue-900/50 text-blue-400 border border-blue-700',
  '大盤代表': 'bg-gray-700 text-gray-300 border border-gray-600',
  '主題 ETF': 'bg-purple-900/50 text-purple-400 border border-purple-700',
}

const LEVEL_STYLE = {
  '高關聯度': 'bg-red-900/40 text-red-400',
  '中關聯度': 'bg-amber-900/40 text-amber-400',
  '低關聯度': 'bg-gray-800 text-gray-500',
}

const pct = (n) => n == null ? null : (n >= 0 ? '+' : '') + parseFloat(n).toFixed(2) + '%'
const pctColor = (n) => n == null ? 'text-gray-600' : n >= 0 ? 'text-green-400' : 'text-red-400'

// ── 股票卡片 ─────────────────────────────────────────
function StockCard({ stock, price, onAdd, added }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white text-base">{stock.name}</span>
            <span className="text-gray-500 text-sm">（{stock.symbol}）</span>
            {stock.role && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_STYLE[stock.role] || 'bg-gray-800 text-gray-400'}`}>
                {stock.role}
              </span>
            )}
          </div>
          {stock.note && <p className="text-xs text-gray-500 mt-1">{stock.note}</p>}
          {stock.level && (
            <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded font-medium ${LEVEL_STYLE[stock.level] || ''}`}>
              {stock.level}
            </span>
          )}
        </div>

        {/* 右側：股價 + 按鈕 */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {price?.price ? (
            <div className="text-right">
              <div className="text-white font-semibold">{parseFloat(price.price).toFixed(2)}</div>
              <div className={`text-sm font-medium ${pctColor(price.daily_change)}`}>
                {pct(price.daily_change) || '—'}
              </div>
            </div>
          ) : (
            <div className="text-gray-600 text-sm text-right">
              <div>—</div>
              <div>—</div>
            </div>
          )}
          <button
            onClick={() => !added && onAdd(stock)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              added
                ? 'bg-green-900/30 text-green-400 border border-green-800'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700'
            }`}>
            {added ? <Check className="w-3 h-3" /> : <Heart className="w-3 h-3" />}
            {added ? '已收藏' : '加入收藏'}
          </button>
        </div>
      </div>

      {/* 週/月漲跌 */}
      {price?.price && (
        <div className="flex gap-4 mt-3 pt-3 border-t border-gray-800">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-600">週</span>
            <span className={`text-xs font-medium ${pctColor(price.weekly_change)}`}>{pct(price.weekly_change) || '—'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-600">月</span>
            <span className={`text-xs font-medium ${pctColor(price.monthly_change)}`}>{pct(price.monthly_change) || '—'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-600">今年</span>
            <span className={`text-xs font-medium ${pctColor(price.ytd_change)}`}>{pct(price.ytd_change) || '—'}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 主頁面 ────────────────────────────────────────────
export default function IndustryMap() {
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(false)
  const [addedStocks, setAddedStocks] = useState({})
  const [watchlistTabs, setWatchlistTabs] = useState([])
  const [showAddModal, setShowAddModal] = useState(null)
  const [selectedTab, setSelectedTab] = useState('')
  const [expandedTiers, setExpandedTiers] = useState({ UPSTREAM: true, MIDSTREAM: true, DOWNSTREAM: true })
  const [expandedCats, setExpandedCats] = useState({})
  const [activeTier, setActiveTier] = useState(null) // null = 全部

  useEffect(() => {
    fetchAllPrices()
    fetchWatchlistTabs()
  }, [])

  const fetchAllPrices = async () => {
    setLoading(true)
    const allSymbols = [...new Set(
      SUPPLY_CHAIN.flatMap(t => t.categories.flatMap(c => c.subcategories.flatMap(s => s.stocks.map(st => st.symbol))))
    )].join(',')
    try {
      const res = await fetch(`${API}/api/prices?symbols=${allSymbols}`)
      const data = await res.json()
      setPrices(data)
    } catch {}
    setLoading(false)
  }

  const fetchWatchlistTabs = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('watchlist_tabs').select('*').eq('user_id', user.id).order('sort_order')
    setWatchlistTabs(data || [])
    if (data?.length > 0) setSelectedTab(data[0].id)
  }

  const handleAdd = (stock) => setShowAddModal(stock)

  const confirmAdd = async () => {
    if (!showAddModal || !selectedTab) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('watchlist_items').upsert({
      user_id: user.id, tab_id: selectedTab,
      symbol: showAddModal.symbol, name: showAddModal.name,
    }, { onConflict: 'user_id,tab_id,symbol' })
    setAddedStocks(p => ({ ...p, [showAddModal.symbol]: true }))
    setShowAddModal(null)
  }

  const toggleCat = (key) => setExpandedCats(p => ({ ...p, [key]: !p[key] }))

  const displayChain = activeTier ? SUPPLY_CHAIN.filter(t => t.tier === activeTier) : SUPPLY_CHAIN

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 標題列 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-white">AI 產業地圖</h1>
          <p className="text-xs text-gray-500 mt-0.5">台灣 AI 供應鏈完整覆蓋 · 上中下游分層</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 層級篩選 */}
          <div className="flex gap-1">
            {[null, 'UPSTREAM', 'MIDSTREAM', 'DOWNSTREAM'].map((tier) => {
              const t = SUPPLY_CHAIN.find(x => x.tier === tier)
              return (
                <button key={tier || 'all'}
                  onClick={() => setActiveTier(tier)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeTier === tier
                      ? tier ? `text-white` : 'bg-gray-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                  style={activeTier === tier && tier ? { background: t?.color + '33', color: t?.color, border: `1px solid ${t?.color}66` } : {}}>
                  {tier ? `${t?.label}（${tier}）` : '全部'}
                </button>
              )
            })}
          </div>
          <button onClick={fetchAllPrices} disabled={loading}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white border border-gray-700 px-3 py-2 rounded-lg text-sm transition-colors ml-2">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 主內容 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {displayChain.map(tier => (
          <div key={tier.tier}>
            {/* 層級標題 */}
            <div className="flex items-center gap-3 mb-4 cursor-pointer"
              onClick={() => setExpandedTiers(p => ({ ...p, [tier.tier]: !p[tier.tier] }))}>
              <div className="flex items-center gap-3 flex-1 p-3 rounded-xl"
                style={{ background: tier.bg, border: `1px solid ${tier.border}` }}>
                <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: tier.color }} />
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold tracking-widest" style={{ color: tier.color }}>{tier.tier}</span>
                    <span className="text-white font-semibold">{tier.label}</span>
                    <span className="text-xs text-gray-500">
                      {tier.categories.length} 類 · {tier.categories.reduce((s, c) => s + c.subcategories.reduce((ss, sc) => ss + sc.stocks.length, 0), 0)} 家公司
                    </span>
                  </div>
                </div>
                {expandedTiers[tier.tier]
                  ? <ChevronUp className="w-4 h-4 text-gray-500" />
                  : <ChevronDown className="w-4 h-4 text-gray-500" />
                }
              </div>
            </div>

            {/* 分類列表 */}
            {expandedTiers[tier.tier] && tier.categories.map(cat => {
              const catKey = `${tier.tier}-${cat.name}`
              const isOpen = expandedCats[catKey] !== false // 預設展開
              return (
                <div key={cat.name} className="mb-4 border border-gray-800 rounded-2xl overflow-hidden">
                  {/* 分類標題 */}
                  <button className="w-full flex items-center justify-between px-5 py-4 bg-gray-900 hover:bg-gray-800/80 transition-colors"
                    onClick={() => toggleCat(catKey)}>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{cat.name}</span>
                        <span className="text-xs text-gray-500">
                          （{cat.subcategories.reduce((s, sc) => s + sc.stocks.length, 0)} 家）
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{cat.desc}</p>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-600 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-600 flex-shrink-0" />}
                  </button>

                  {/* 子分類 */}
                  {isOpen && cat.subcategories.map(sub => (
                    <div key={sub.name} className="border-t border-gray-800 px-5 py-4">
                      <div className="mb-3">
                        <h4 className="text-sm font-semibold text-gray-200">{sub.name}
                          <span className="text-gray-600 font-normal ml-2 text-xs">（{sub.stocks.length} 家公司）</span>
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">{sub.desc}</p>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                        {sub.stocks.map(stock => (
                          <StockCard
                            key={stock.symbol}
                            stock={stock}
                            price={prices[stock.symbol]}
                            onAdd={handleAdd}
                            added={!!addedStocks[stock.symbol]}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* 加入收藏 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">加入觀察清單</h3>
              <button onClick={() => setShowAddModal(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              將 <span className="text-white font-medium">{showAddModal.symbol} {showAddModal.name}</span> 加入到：
            </p>
            {watchlistTabs.length === 0 ? (
              <p className="text-gray-500 text-sm mb-4">請先在觀察清單建立分頁</p>
            ) : (
              <div className="space-y-2 mb-4">
                {watchlistTabs.map(tab => (
                  <button key={tab.id} onClick={() => setSelectedTab(tab.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      selectedTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}>{tab.name}</button>
                ))}
              </div>
            )}
            <button onClick={confirmAdd}
              disabled={!selectedTab || !watchlistTabs.length}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
              確認加入
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
