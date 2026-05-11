import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { RefreshCw, X, Check, Heart, ChevronRight } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── 節點資料 ──────────────────────────────────────────
const LAYERS = [
  {
    id: 'chip',
    label: 'AI 晶片設計',
    color: '#818cf8',
    y: 0,
    nodes: [
      {
        id: 'asic-ip', label: 'ASIC / IP 設計', x: 0,
        desc: '矽智財授權、ASIC 晶片設計',
        stocks: [
          { symbol: '3529', name: '力旺', role: '產業龍頭', note: 'eNVM IP 全球市佔第一' },
          { symbol: '6643', name: 'M31', role: '利基專精', note: '高速介面 IP' },
          { symbol: '6533', name: '晶心科', role: '利基專精', note: 'RISC-V CPU IP' },
          { symbol: '3443', name: '創意', role: '利基專精', note: 'ASIC 設計服務' },
          { symbol: '6423', name: '億而得-創', role: '利基專精', note: '安全 IP 設計' },
        ]
      },
      {
        id: 'hpc-ic', label: 'HPC 與網通 IC', x: 1,
        desc: '高效能運算、AI、網路交換器 IC',
        stocks: [
          { symbol: '2454', name: '聯發科', role: '產業龍頭', note: 'AI 晶片設計龍頭' },
          { symbol: '2379', name: '瑞昱', role: '產業龍頭', note: '網路 IC / AI PC' },
          { symbol: '4966', name: '譜瑞-KY', role: '利基專精', note: 'PCIe 介面 IC' },
        ]
      },
      {
        id: 'cxl', label: 'CXL 記憶體池化', x: 2,
        desc: 'CXL 介面、記憶體擴充技術',
        stocks: [
          { symbol: '3014', name: '聯陽', role: '利基專精', note: 'CXL / USB 介面 IC' },
          { symbol: '2303', name: '聯電', role: '產業龍頭', note: '成熟製程代工' },
        ]
      },
    ]
  },
  {
    id: 'packaging',
    label: '先進封裝製程',
    color: '#a78bfa',
    y: 1,
    nodes: [
      {
        id: 'pkg-equip', label: '先進封裝設備', x: 0,
        desc: 'IC 封裝製程設備供應商',
        stocks: [
          { symbol: '6640', name: '均華', role: '利基專精', note: '封裝設備' },
          { symbol: '6223', name: '旺矽', role: '利基專精', note: '探針卡測試' },
          { symbol: '3030', name: '燿華', role: '利基專精', note: 'PCB 設備' },
        ]
      },
      {
        id: 'substrate', label: '封裝材料 / 載板', x: 1,
        desc: 'ABF 載板、封裝基板材料',
        stocks: [
          { symbol: '3037', name: '欣興電子', role: '產業龍頭', note: 'ABF 載板龍頭' },
          { symbol: '8046', name: '南電', role: '利基專精', note: 'ABF 載板' },
          { symbol: '3189', name: '景碩', role: '利基專精', note: 'IC 載板' },
        ]
      },
      {
        id: 'glass', label: '玻璃基板', x: 2,
        desc: '次世代封裝基板，取代有機載板',
        stocks: [
          { symbol: '1802', name: '台玻', role: '關注', note: '玻璃基板潛在受益' },
          { symbol: '2330', name: '台積電', role: '產業龍頭', note: 'CoWoS 封裝平台' },
        ]
      },
      {
        id: 'cowos', label: 'CoWoS 先進封裝', x: 3,
        desc: '晶圓級系統整合封裝技術',
        stocks: [
          { symbol: '2330', name: '台積電', role: '產業龍頭', note: 'CoWoS 唯一量產廠' },
          { symbol: '3711', name: '日月光投控', role: '產業龍頭', note: '全球最大封測廠' },
          { symbol: '2325', name: '矽品', role: '產業龍頭', note: 'SiP 封裝' },
        ]
      },
      {
        id: 'test', label: '高階測試介面', x: 4,
        desc: 'IC 測試介面、探針卡、測試機台',
        stocks: [
          { symbol: '2449', name: '京元電', role: '利基專精', note: 'IC 測試服務' },
          { symbol: '6257', name: '矽格', role: '利基專精', note: 'IC 封裝測試' },
          { symbol: '6239', name: '力成', role: '利基專精', note: '記憶體封測' },
        ]
      },
      {
        id: 'hbm', label: 'HBM 供應鏈', x: 5,
        desc: '高頻寬記憶體相關供應鏈',
        stocks: [
          { symbol: '3006', name: '晶豪科', role: '利基專精', note: 'HBM 相關記憶體' },
          { symbol: '2408', name: '南亞科', role: '利基專精', note: 'DRAM 製造' },
          { symbol: '4256', name: '松翰', role: '利基專精', note: '記憶體控制 IC' },
        ]
      },
    ]
  },
  {
    id: 'server-parts',
    label: 'AI 伺服器元件',
    color: '#34d399',
    y: 2,
    nodes: [
      {
        id: 'cpo', label: '矽光子 CPO', x: 0,
        desc: '共封裝光學，解決高速傳輸瓶頸',
        stocks: [
          { symbol: '8076', name: '波若威', role: '利基專精', note: '光收發模組' },
          { symbol: '4977', name: '眾達-KY', role: '利基專精', note: '光模組代工' },
        ]
      },
      {
        id: 'connector', label: '高速連接器', x: 1,
        desc: '伺服器內部高速訊號連接介面',
        stocks: [
          { symbol: '3533', name: '嘉澤', role: '利基專精', note: 'AI 伺服器連接器' },
          { symbol: '2392', name: '正崴', role: '利基專精', note: '連接器 / 線材' },
          { symbol: '2367', name: '燿華', role: '利基專精', note: '連接器' },
        ]
      },
      {
        id: 'air-cool', label: '散熱與氣冷', x: 2,
        desc: '傳統風冷散熱模組與風扇',
        stocks: [
          { symbol: '2421', name: '建準', role: '利基專精', note: '散熱風扇龍頭' },
          { symbol: '3017', name: '奇鋐', role: '利基專精', note: '散熱模組' },
          { symbol: '6230', name: '超眾', role: '利基專精', note: 'AI 伺服器散熱' },
        ]
      },
      {
        id: 'liquid-cool', label: '液冷散熱系統', x: 3,
        desc: '直接液冷（DLC）/ CDU 冷卻系統',
        stocks: [
          { symbol: '3217', name: '雙鴻', role: '產業龍頭', note: '液冷散熱龍頭' },
          { symbol: '2308', name: '台達電', role: '產業龍頭', note: '電源 + 液冷系統' },
          { symbol: '6230', name: '超眾', role: '利基專精', note: '液冷受益' },
        ]
      },
      {
        id: 'bbu', label: 'BBU 備援系統', x: 4,
        desc: '電池備援系統，確保 AI 資料中心不斷電',
        stocks: [
          { symbol: '3617', name: '碩天', role: '利基專精', note: 'UPS 電源' },
          { symbol: '2308', name: '台達電', role: '產業龍頭', note: 'UPS / 電源管理' },
        ]
      },
      {
        id: 'psu', label: '電源供應器', x: 5,
        desc: '伺服器高效電源供應模組',
        stocks: [
          { symbol: '2308', name: '台達電', role: '產業龍頭', note: '電源供應器龍頭' },
          { symbol: '6409', name: '旭隼', role: '利基專精', note: '電源模組' },
          { symbol: '6412', name: '群電', role: '利基專精', note: '電源供應器' },
        ]
      },
      {
        id: 'mlcc', label: 'MLCC 電容', x: 6,
        desc: '多層陶瓷電容，伺服器用量龐大',
        stocks: [
          { symbol: '2327', name: '國巨', role: '產業龍頭', note: 'MLCC 全球前三大' },
          { symbol: '3026', name: '禾伸堂', role: '利基專精', note: 'MLCC 通路商' },
          { symbol: '2456', name: '奇力新', role: '利基專精', note: '功率電感' },
        ]
      },
      {
        id: 'inductor', label: '功率電感', x: 7,
        desc: '伺服器電源轉換用功率電感',
        stocks: [
          { symbol: '2456', name: '奇力新', role: '利基專精', note: '功率電感龍頭' },
          { symbol: '2327', name: '國巨', role: '產業龍頭', note: '被動元件龍頭' },
        ]
      },
    ]
  },
  {
    id: 'application',
    label: 'AI 終端應用',
    color: '#38bdf8',
    y: 3,
    nodes: [
      {
        id: 'optical-mod', label: '高速光模組', x: 0,
        desc: '400G/800G 高速光收發模組',
        stocks: [
          { symbol: '8076', name: '波若威', role: '利基專精', note: '光收發模組' },
          { symbol: '2345', name: '智邦', role: '產業龍頭', note: '400G/800G 交換器' },
        ]
      },
      {
        id: 'server-assembly', label: 'AI 伺服器組裝', x: 1,
        desc: 'AI 伺服器 ODM 整機組裝',
        stocks: [
          { symbol: '2382', name: '廣達', role: '產業龍頭', note: 'NVIDIA AI 伺服器最大代工' },
          { symbol: '2317', name: '鴻海', role: '產業龍頭', note: 'GB200 NVL72 代工' },
          { symbol: '3231', name: '緯創', role: '產業龍頭', note: 'AI 伺服器 ODM' },
          { symbol: '2356', name: '英業達', role: '利基專精', note: '伺服器代工' },
          { symbol: '2324', name: '仁寶', role: '利基專精', note: '伺服器 + 筆電' },
        ]
      },
      {
        id: 'chassis', label: '機殼與滑軌', x: 2,
        desc: '伺服器機殼、機架、滑軌',
        stocks: [
          { symbol: '8210', name: '勤誠', role: '利基專精', note: '伺服器機殼' },
          { symbol: '2059', name: '川湖', role: '利基專精', note: '滑軌全球龍頭' },
        ]
      },
      {
        id: 'network-equip', label: '網通設備', x: 3,
        desc: '資料中心網路交換設備整機',
        stocks: [
          { symbol: '2345', name: '智邦', role: '產業龍頭', note: '網通設備龍頭' },
          { symbol: '6669', name: '緯穎', role: '利基專精', note: 'AI 伺服器 + 網路' },
          { symbol: '4924', name: '炎洲', role: '利基專精', note: '電纜線材' },
        ]
      },
      {
        id: 'edge-ai', label: 'Edge AI / AIoT', x: 4,
        desc: '邊緣運算 AI、工業物聯網應用',
        stocks: [
          { symbol: '2395', name: '研華', role: '產業龍頭', note: '工業電腦龍頭' },
          { symbol: '6582', name: '申泰', role: '利基專精', note: 'Edge AI 設備' },
        ]
      },
      {
        id: 'satellite', label: '低軌衛星', x: 5,
        desc: 'AI 驅動的低軌衛星通訊應用',
        stocks: [
          { symbol: '2314', name: '台揚', role: '利基專精', note: '衛星通訊設備' },
          { symbol: '3045', name: '台灣大', role: '利基專精', note: '5G / 衛星通訊' },
        ]
      },
      {
        id: 'defense', label: '軍工產業', x: 6,
        desc: 'AI 在國防、無人機、軍事應用',
        stocks: [
          { symbol: '2634', name: '漢翔', role: '利基專精', note: '航太製造' },
          { symbol: '8044', name: '網家', role: '關注', note: '無人機相關' },
        ]
      },
    ]
  },
]

// 連線定義：[from_node_id, to_node_id]
const CONNECTIONS = [
  ['asic-ip', 'substrate'],
  ['asic-ip', 'cowos'],
  ['asic-ip', 'cpo'],
  ['asic-ip', 'server-assembly'],
  ['hpc-ic', 'cowos'],
  ['hpc-ic', 'hbm'],
  ['hpc-ic', 'network-equip'],
  ['cxl', 'hbm'],
  ['pkg-equip', 'cowos'],
  ['substrate', 'cowos'],
  ['substrate', 'server-assembly'],
  ['glass', 'cowos'],
  ['cowos', 'server-assembly'],
  ['test', 'server-assembly'],
  ['hbm', 'server-assembly'],
  ['hbm', 'defense'],
  ['cpo', 'optical-mod'],
  ['cpo', 'server-assembly'],
  ['air-cool', 'server-assembly'],
  ['liquid-cool', 'server-assembly'],
  ['bbu', 'server-assembly'],
  ['psu', 'server-assembly'],
  ['mlcc', 'server-assembly'],
  ['inductor', 'server-assembly'],
  ['connector', 'server-assembly'],
  ['optical-mod', 'network-equip'],
]

const ROLE_STYLE = {
  '產業龍頭': 'bg-green-900/60 text-green-400 border-green-700',
  '利基專精': 'bg-blue-900/60 text-blue-400 border-blue-700',
  '關注': 'bg-gray-800 text-gray-400 border-gray-600',
}

const pct = (n) => n == null ? '—' : (n >= 0 ? '+' : '') + parseFloat(n).toFixed(2) + '%'
const pctColor = (n) => n == null ? 'text-gray-600' : n >= 0 ? 'text-green-400' : 'text-red-400'

// 建立 node lookup map
const NODE_MAP = {}
LAYERS.forEach(layer => {
  layer.nodes.forEach(node => {
    NODE_MAP[node.id] = { ...node, layerColor: layer.color, layerY: layer.y }
  })
})

export default function IndustryMap() {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const [nodePositions, setNodePositions] = useState({})
  const [selectedNode, setSelectedNode] = useState(null)
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(false)
  const [addedStocks, setAddedStocks] = useState({})
  const [watchlistTabs, setWatchlistTabs] = useState([])
  const [showAddModal, setShowAddModal] = useState(null)
  const [selectedTab, setSelectedTab] = useState('')

  useEffect(() => {
    fetchAllPrices()
    fetchWatchlistTabs()
  }, [])

  const fetchAllPrices = async () => {
    setLoading(true)
    const allSymbols = [...new Set(
      LAYERS.flatMap(l => l.nodes.flatMap(n => n.stocks.map(s => s.symbol)))
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

  // 計算節點位置
  const NODE_W = 140
  const NODE_H = 48
  const LAYER_H = 140
  const PADDING_X = 40
  const PADDING_Y = 60
  const GAP_X = 16

  const getLayerNodes = (layerIdx) => LAYERS[layerIdx].nodes
  const totalLayers = LAYERS.length
  const maxNodesPerLayer = Math.max(...LAYERS.map(l => l.nodes.length))
  const svgWidth = maxNodesPerLayer * (NODE_W + GAP_X) + PADDING_X * 2
  const svgHeight = totalLayers * LAYER_H + PADDING_Y * 2

  const getNodePos = (layerIdx, nodeIdx, totalNodes) => {
    const totalW = totalNodes * NODE_W + (totalNodes - 1) * GAP_X
    const startX = (svgWidth - totalW) / 2
    const x = startX + nodeIdx * (NODE_W + GAP_X)
    const y = PADDING_Y + layerIdx * LAYER_H
    return { x, y, cx: x + NODE_W / 2, cy: y + NODE_H / 2 }
  }

  // 建立 nodeId → position 的映射
  const posMap = {}
  LAYERS.forEach((layer, li) => {
    layer.nodes.forEach((node, ni) => {
      posMap[node.id] = getNodePos(li, ni, layer.nodes.length)
    })
  })

  // 畫連線路徑
  const renderConnections = () => {
    return CONNECTIONS.map(([from, to], i) => {
      const fp = posMap[from]
      const tp = posMap[to]
      if (!fp || !tp) return null
      const x1 = fp.cx, y1 = fp.y + NODE_H
      const x2 = tp.cx, y2 = tp.y
      const mx = (x1 + x2) / 2
      const my = (y1 + y2) / 2
      const isHighlighted = selectedNode && (selectedNode.id === from || selectedNode.id === to)
      return (
        <path key={i}
          d={`M ${x1} ${y1} C ${x1} ${my} ${x2} ${my} ${x2} ${y2}`}
          fill="none"
          stroke={isHighlighted ? '#60a5fa' : 'rgba(99,102,241,0.25)'}
          strokeWidth={isHighlighted ? 2 : 1}
          markerEnd={`url(#arrow-${isHighlighted ? 'highlight' : 'normal'})`}
          opacity={selectedNode && !isHighlighted ? 0.2 : 1}
          style={{ transition: 'opacity 0.2s, stroke 0.2s' }}
        />
      )
    })
  }

  const selectedStocks = selectedNode?.stocks || []

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-950">
      {/* 標題列 */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">AI 產業地圖</h1>
          <p className="text-xs text-gray-500">點擊節點查看相關台股 · 點擊空白處取消選取</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 圖例 */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {LAYERS.map(l => (
              <div key={l.id} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                <span>{l.label}</span>
              </div>
            ))}
          </div>
          <button onClick={fetchAllPrices} disabled={loading}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-lg text-sm transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 流程圖 */}
        <div className="flex-1 overflow-auto p-4" onClick={() => setSelectedNode(null)}>
          <svg ref={svgRef}
            width={svgWidth} height={svgHeight}
            style={{ minWidth: '900px' }}>
            <defs>
              <marker id="arrow-normal" viewBox="0 0 10 10" refX="8" refY="5"
                markerWidth="5" markerHeight="5" orient="auto">
                <path d="M0,2 L8,5 L0,8 Z" fill="rgba(99,102,241,0.5)" />
              </marker>
              <marker id="arrow-highlight" viewBox="0 0 10 10" refX="8" refY="5"
                markerWidth="5" markerHeight="5" orient="auto">
                <path d="M0,2 L8,5 L0,8 Z" fill="#60a5fa" />
              </marker>
            </defs>

            {/* 層級背景 */}
            {LAYERS.map((layer, li) => {
              const y = PADDING_Y + li * LAYER_H - 24
              return (
                <g key={layer.id}>
                  <text x={PADDING_X - 10} y={y + 14} fill={layer.color}
                    fontSize={11} fontWeight="600" opacity={0.8}>
                    {layer.label}
                  </text>
                  <line x1={PADDING_X - 10} y1={y + 20} x2={svgWidth - PADDING_X + 10} y2={y + 20}
                    stroke={layer.color} strokeWidth={0.5} opacity={0.2} strokeDasharray="4 4" />
                </g>
              )
            })}

            {/* 連線 */}
            {renderConnections()}

            {/* 節點 */}
            {LAYERS.map((layer, li) =>
              layer.nodes.map((node, ni) => {
                const { x, y } = getNodePos(li, ni, layer.nodes.length)
                const isSelected = selectedNode?.id === node.id
                const isConnected = selectedNode && CONNECTIONS.some(
                  ([f, t]) => (f === selectedNode.id && t === node.id) || (t === selectedNode.id && f === node.id)
                )
                const opacity = selectedNode && !isSelected && !isConnected ? 0.4 : 1

                return (
                  <g key={node.id} style={{ opacity, transition: 'opacity 0.2s', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedNode(isSelected ? null : node) }}>
                    {/* 節點框 */}
                    <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={8}
                      fill={isSelected ? layer.color + '33' : 'rgba(17,24,39,0.9)'}
                      stroke={isSelected ? layer.color : isConnected ? layer.color + '88' : layer.color + '55'}
                      strokeWidth={isSelected ? 2 : 1}
                    />
                    {/* 節點文字 */}
                    <text x={x + NODE_W / 2} y={y + NODE_H / 2 - 2}
                      textAnchor="middle" dominantBaseline="middle"
                      fill={isSelected ? layer.color : '#e5e7eb'}
                      fontSize={12} fontWeight={isSelected ? '600' : '400'}>
                      {node.label.length > 10 ? node.label.slice(0, 10) + '…' : node.label}
                    </text>
                    <text x={x + NODE_W / 2} y={y + NODE_H / 2 + 14}
                      textAnchor="middle" dominantBaseline="middle"
                      fill={layer.color + 'aa'} fontSize={9}>
                      {node.stocks.length} 家
                    </text>
                  </g>
                )
              })
            )}
          </svg>
        </div>

        {/* 右側股票面板 */}
        {selectedNode && (
          <div className="w-80 border-l border-gray-800 flex flex-col flex-shrink-0 overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* 面板標題 */}
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-sm">{selectedNode.label}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedNode.desc}</p>
              </div>
              <button onClick={() => setSelectedNode(null)}
                className="text-gray-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 連結節點 */}
            <div className="px-4 py-2 border-b border-gray-800">
              <p className="text-xs text-gray-600 mb-1.5">相關節點</p>
              <div className="flex flex-wrap gap-1">
                {CONNECTIONS
                  .filter(([f, t]) => f === selectedNode.id || t === selectedNode.id)
                  .map(([f, t]) => {
                    const otherId = f === selectedNode.id ? t : f
                    const other = NODE_MAP[otherId]
                    return other ? (
                      <button key={otherId}
                        onClick={() => setSelectedNode(other)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
                        style={{ color: other.layerColor || '#9ca3af' }}>
                        <ChevronRight className="w-2.5 h-2.5" />
                        {other.label}
                      </button>
                    ) : null
                  })}
              </div>
            </div>

            {/* 股票列表 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {selectedStocks.map(stock => {
                const p = prices[stock.symbol]
                const isAdded = addedStocks[stock.symbol]
                return (
                  <div key={stock.symbol}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-3 hover:border-gray-700 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white text-sm">{stock.name}</span>
                          <span className="text-gray-500 text-xs">({stock.symbol})</span>
                        </div>
                        {stock.role && (
                          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full border ${ROLE_STYLE[stock.role] || ''}`}>
                            {stock.role}
                          </span>
                        )}
                        {stock.note && <p className="text-xs text-gray-500 mt-1">{stock.note}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {p?.price ? (
                          <>
                            <div className="text-white text-sm font-medium">{parseFloat(p.price).toFixed(2)}</div>
                            <div className={`text-xs ${pctColor(p.daily_change)}`}>{pct(p.daily_change)}</div>
                          </>
                        ) : <div className="text-gray-600 text-sm">—</div>}
                      </div>
                    </div>

                    {p?.price && (
                      <div className="flex gap-3 mt-2 pt-2 border-t border-gray-800 text-xs">
                        <span className="text-gray-600">週 <span className={pctColor(p.weekly_change)}>{pct(p.weekly_change)}</span></span>
                        <span className="text-gray-600">月 <span className={pctColor(p.monthly_change)}>{pct(p.monthly_change)}</span></span>
                      </div>
                    )}

                    <button onClick={() => !isAdded && setShowAddModal(stock)}
                      className={`mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isAdded ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700'
                      }`}>
                      {isAdded ? <><Check className="w-3 h-3" /> 已加入</> : <><Heart className="w-3 h-3" /> 加入觀察清單</>}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 加入 Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">加入觀察清單</h3>
              <button onClick={() => setShowAddModal(null)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              將 <span className="text-white font-medium">{showAddModal.symbol} {showAddModal.name}</span> 加入到：
            </p>
            <div className="space-y-2 mb-4">
              {watchlistTabs.map(tab => (
                <button key={tab.id} onClick={() => setSelectedTab(tab.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    selectedTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}>{tab.name}</button>
              ))}
            </div>
            <button onClick={confirmAdd} disabled={!selectedTab}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white py-2.5 rounded-lg text-sm font-medium">
              確認加入
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
