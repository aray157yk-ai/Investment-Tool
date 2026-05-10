import { useEffect, useRef, useState, useCallback } from 'react'
import { RefreshCw, Minus, TrendingUp, Square, Trash2, MousePointer } from 'lucide-react'

const API = 'http://localhost:8000'

const INTERVALS = [
  { label: '日', value: 'D' },
  { label: '週', value: 'W' },
  { label: '月', value: 'M' },
]

function aggregateData(dailyData, interval) {
  if (interval === 'D') return dailyData
  const groups = {}
  for (const d of dailyData) {
    const date = new Date(d.date)
    let key
    if (interval === 'W') {
      const day = date.getDay()
      const diff = (day === 0 ? -6 : 1) - day
      const monday = new Date(date)
      monday.setDate(date.getDate() + diff)
      key = monday.toISOString().slice(0, 10)
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    }
    if (!groups[key]) {
      groups[key] = { date: key, open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume }
    } else {
      groups[key].high = Math.max(groups[key].high, d.high)
      groups[key].low = Math.min(groups[key].low, d.low)
      groups[key].close = d.close
      groups[key].volume += d.volume
    }
  }
  return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date))
}

function calcMA(data, n) {
  return data.map((_, i) => {
    if (i < n - 1) return null
    const avg = data.slice(i - n + 1, i + 1).reduce((s, d) => s + d.close, 0) / n
    return { time: data[i].date, value: parseFloat(avg.toFixed(2)) }
  }).filter(Boolean)
}

// 畫線工具
const DRAW_TOOLS = [
  { id: 'cursor', icon: MousePointer, label: '游標' },
  { id: 'hline', icon: Minus, label: '水平線' },
  { id: 'trendline', icon: TrendingUp, label: '趨勢線' },
  { id: 'rect', icon: Square, label: '矩形' },
]

export default function TaiwanChart({ symbol }) {
  const containerRef = useRef(null)
  const overlayRef = useRef(null) // SVG 覆蓋層（畫線用）
  const chartRef = useRef(null)
  const seriesRef = useRef({})
  const rawDataRef = useRef([])
  const chartInfoRef = useRef({ width: 0, height: 0, priceMin: 0, priceMax: 1, timeMin: 0, timeMax: 1 })

  const [interval, setIntervalVal] = useState('D')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ohlcv, setOhlcv] = useState(null)
  const [showMA20, setShowMA20] = useState(true)
  const [showMA60, setShowMA60] = useState(true)
  const [showVol, setShowVol] = useState(true)

  // 畫線相關
  const [activeTool, setActiveTool] = useState('cursor')
  const [drawings, setDrawings] = useState([]) // { id, type, points, color }
  const [isDrawing, setIsDrawing] = useState(false)
  const [tempPoint, setTempPoint] = useState(null)
  const drawStateRef = useRef({ isDrawing: false, startPoint: null, tool: 'cursor' })
  const svgRef = useRef(null)

  // 建立圖表
  useEffect(() => {
    if (!containerRef.current) return
    let chart = null

    const init = async () => {
      const lwc = await import('lightweight-charts')
      const isV5 = !!lwc.CandlestickSeries

      chart = lwc.createChart(containerRef.current, {
        layout: { background: { color: '#111827' }, textColor: '#9ca3af' },
        grid: { vertLines: { color: '#1f2937' }, horzLines: { color: '#1f2937' } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: '#374151', scaleMargins: { top: 0.08, bottom: 0.22 } },
        timeScale: { borderColor: '#374151', timeVisible: false },
        width: containerRef.current.clientWidth,
        height: 520,
      })

      let candleSeries, volumeSeries, ma20Series, ma60Series

      if (isV5) {
        candleSeries = chart.addSeries(lwc.CandlestickSeries, {
          upColor: '#10b981', downColor: '#ef4444',
          borderUpColor: '#10b981', borderDownColor: '#ef4444',
          wickUpColor: '#10b981', wickDownColor: '#ef4444',
        })
        volumeSeries = chart.addSeries(lwc.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
        ma20Series = chart.addSeries(lwc.LineSeries, { color: '#fbbf24', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true })
        ma60Series = chart.addSeries(lwc.LineSeries, { color: '#a78bfa', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true })
      } else {
        candleSeries = chart.addCandlestickSeries({
          upColor: '#10b981', downColor: '#ef4444',
          borderUpColor: '#10b981', borderDownColor: '#ef4444',
          wickUpColor: '#10b981', wickDownColor: '#ef4444',
        })
        volumeSeries = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
        ma20Series = chart.addLineSeries({ color: '#fbbf24', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true })
        ma60Series = chart.addLineSeries({ color: '#a78bfa', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true })
      }

      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.seriesData) { setOhlcv(null); return }
        const c = param.seriesData.get(candleSeries)
        const v = param.seriesData.get(volumeSeries)
        if (c) setOhlcv({ ...c, volume: v?.value, isUp: c.close >= c.open })
        else setOhlcv(null)
      })

      const onResize = () => {
        if (containerRef.current && chart) {
          chart.applyOptions({ width: containerRef.current.clientWidth })
        }
      }
      window.addEventListener('resize', onResize)

      chartRef.current = chart
      seriesRef.current = { candleSeries, volumeSeries, ma20Series, ma60Series }

      await fetchData()
      return () => window.removeEventListener('resize', onResize)
    }

    init()
    return () => {
      if (chart) { chart.remove(); chartRef.current = null; seriesRef.current = {} }
    }
  }, [symbol])

  useEffect(() => {
    if (rawDataRef.current.length > 0 && chartRef.current) renderChart(rawDataRef.current, interval)
  }, [interval])

  useEffect(() => {
    if (seriesRef.current.ma20Series) seriesRef.current.ma20Series.applyOptions({ visible: showMA20 })
  }, [showMA20])
  useEffect(() => {
    if (seriesRef.current.ma60Series) seriesRef.current.ma60Series.applyOptions({ visible: showMA60 })
  }, [showMA60])
  useEffect(() => {
    if (seriesRef.current.volumeSeries) seriesRef.current.volumeSeries.applyOptions({ visible: showVol })
  }, [showVol])

  useEffect(() => {
    drawStateRef.current.tool = activeTool
    if (chartRef.current) {
      const isCursor = activeTool === 'cursor'
      chartRef.current.applyOptions({ handleScale: isCursor, handleScroll: isCursor })
    }
  }, [activeTool])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/history/${symbol}?period=5y`)
      const json = await res.json()
      if (json.error) { setError(json.error); setLoading(false); return }
      const data = json.data || []
      if (!data.length) { setError('無歷史資料'); setLoading(false); return }
      rawDataRef.current = data
      renderChart(data, interval)
    } catch { setError('載入失敗，請確認後端已啟動') }
    setLoading(false)
  }

  const renderChart = (rawData, ivl) => {
    const { candleSeries, volumeSeries, ma20Series, ma60Series } = seriesRef.current
    if (!candleSeries) return
    const data = aggregateData(rawData, ivl)
    candleSeries.setData(data.map(d => ({ time: d.date, open: d.open, high: d.high, low: d.low, close: d.close })))
    volumeSeries.setData(data.map(d => ({ time: d.date, value: d.volume, color: d.close >= d.open ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)' })))
    ma20Series.setData(calcMA(data, 20))
    ma60Series.setData(calcMA(data, 60))
    chartRef.current.timeScale().fitContent()
  }

  // 取得 SVG 座標（對應圖表容器）
  const getSVGPoint = (e) => {
    const rect = containerRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  // 取得對應價格（從 Y 座標）
  const getPrice = (y) => {
    const { candleSeries } = seriesRef.current
    if (!candleSeries) return null
    try { return candleSeries.coordinateToPrice(y) } catch { return null }
  }

  // 滑鼠事件
  const handleMouseDown = useCallback((e) => {
    const tool = drawStateRef.current.tool
    if (tool === 'cursor') return
    e.preventDefault()
    const pt = getSVGPoint(e)
    const price = getPrice(pt.y)
    drawStateRef.current.isDrawing = true
    drawStateRef.current.startPoint = { ...pt, price }
    setIsDrawing(true)
    setTempPoint({ ...pt, price })
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!drawStateRef.current.isDrawing) return
    const pt = getSVGPoint(e)
    const price = getPrice(pt.y)
    setTempPoint({ ...pt, price })
  }, [])

  const handleMouseUp = useCallback((e) => {
    if (!drawStateRef.current.isDrawing) return
    const tool = drawStateRef.current.tool
    const start = drawStateRef.current.startPoint
    const end = getSVGPoint(e)
    const endPrice = getPrice(end.y)

    drawStateRef.current.isDrawing = false
    setIsDrawing(false)

    const newDrawing = {
      id: Date.now(),
      type: tool,
      start: { ...start },
      end: { ...end, price: endPrice },
      color: '#f59e0b',
    }

    setDrawings(prev => [...prev, newDrawing])
    setTempPoint(null)
  }, [])

  const removeDrawing = (id) => setDrawings(prev => prev.filter(d => d.id !== id))
  const clearAll = () => setDrawings([])

  // 渲染 SVG 線條
  const renderDrawing = (d, isTemp = false) => {
    const { type, start, end, color, id } = d
    const key = isTemp ? 'temp' : id
    const stroke = isTemp ? '#60a5fa' : color
    const opacity = isTemp ? 0.7 : 1

    if (type === 'hline') {
      return (
        <g key={key} opacity={opacity}>
          <line x1={0} y1={start.y} x2={chartInfoRef.current.width || 1400} y2={start.y}
            stroke={stroke} strokeWidth={1.5} strokeDasharray="6 3" />
          <text x={8} y={start.y - 4} fill={stroke} fontSize={11}>
            {start.price != null ? parseFloat(start.price).toFixed(2) : ''}
          </text>
          {!isTemp && (
            <circle cx={20} cy={start.y} r={6} fill="#ef4444" opacity={0} className="cursor-pointer"
              onClick={() => removeDrawing(id)}
              onMouseOver={e => e.target.setAttribute('opacity', '0.8')}
              onMouseOut={e => e.target.setAttribute('opacity', '0')}
            />
          )}
        </g>
      )
    }

    if (type === 'trendline' && end) {
      return (
        <g key={key} opacity={opacity}>
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y}
            stroke={stroke} strokeWidth={1.5} />
          <circle cx={start.x} cy={start.y} r={3} fill={stroke} />
          <circle cx={end.x} cy={end.y} r={3} fill={stroke} />
          {start.price != null && (
            <text x={start.x + 4} y={start.y - 4} fill={stroke} fontSize={10}>
              {parseFloat(start.price).toFixed(2)}
            </text>
          )}
          {end.price != null && (
            <text x={end.x + 4} y={end.y - 4} fill={stroke} fontSize={10}>
              {parseFloat(end.price).toFixed(2)}
            </text>
          )}
        </g>
      )
    }

    if (type === 'rect' && end) {
      const x = Math.min(start.x, end.x)
      const y = Math.min(start.y, end.y)
      const w = Math.abs(end.x - start.x)
      const h = Math.abs(end.y - start.y)
      return (
        <g key={key} opacity={opacity}>
          <rect x={x} y={y} width={w} height={h}
            stroke={stroke} strokeWidth={1.5} fill={stroke} fillOpacity={0.08} />
          {start.price != null && end.price != null && (
            <text x={x + 4} y={y + 14} fill={stroke} fontSize={10}>
              {Math.max(parseFloat(start.price), parseFloat(end.price)).toFixed(2)} → {Math.min(parseFloat(start.price), parseFloat(end.price)).toFixed(2)}
            </text>
          )}
        </g>
      )
    }
    return null
  }

  const f = (n) => n != null ? parseFloat(n).toFixed(2) : '—'
  const fv = (n) => !n ? '—' : n >= 1e8 ? (n / 1e8).toFixed(1) + '億' : n >= 1e4 ? (n / 1e4).toFixed(0) + '張' : n.toLocaleString()

  return (
    <div>
      {/* 週期切換 */}
      <div className="flex items-center justify-between pb-2 flex-wrap gap-2">
        <div className="flex gap-1">
          {INTERVALS.map(iv => (
            <button key={iv.value} onClick={() => setIntervalVal(iv.value)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                interval === iv.value ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}>
              {iv.label}線
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowMA20(v => !v)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${showMA20 ? 'border-yellow-400 text-yellow-400 bg-gray-800' : 'border-gray-700 text-gray-600'}`}>MA20</button>
          <button onClick={() => setShowMA60(v => !v)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${showMA60 ? 'border-purple-400 text-purple-400 bg-gray-800' : 'border-gray-700 text-gray-600'}`}>MA60</button>
          <button onClick={() => setShowVol(v => !v)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${showVol ? 'border-blue-400 text-blue-400 bg-gray-800' : 'border-gray-700 text-gray-600'}`}>量</button>
          <button onClick={fetchData} disabled={loading}
            className="p-1.5 rounded bg-gray-800 text-gray-400 hover:text-white transition-colors ml-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 畫線工具列 */}
      <div className="flex items-center gap-1.5 pb-2 border-b border-gray-800 mb-2">
        {DRAW_TOOLS.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setActiveTool(id)}
            title={label}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              activeTool === id
                ? 'border-blue-500 text-blue-400 bg-gray-800'
                : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
        {drawings.length > 0 && (
          <button onClick={clearAll}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs border border-red-900 text-red-400 hover:bg-red-900/20 transition-colors ml-1">
            <Trash2 className="w-3 h-3" /> 清除全部（{drawings.length}）
          </button>
        )}
        {activeTool !== 'cursor' && (
          <span className="text-xs text-blue-400 ml-2 animate-pulse">
            {activeTool === 'hline' ? '點擊圖表畫水平線' :
             activeTool === 'trendline' ? '點擊起點，再點終點' :
             '點擊拖曳畫矩形'}
          </span>
        )}
      </div>

      {/* OHLCV 資訊列 */}
      <div className="h-5 flex items-center gap-3 text-xs mb-2">
        {ohlcv ? (
          <>
            <span className="text-gray-500">{String(ohlcv.time)}</span>
            <span className="text-gray-400">開 <span className="text-white">{f(ohlcv.open)}</span></span>
            <span className="text-gray-400">高 <span className="text-green-400">{f(ohlcv.high)}</span></span>
            <span className="text-gray-400">低 <span className="text-red-400">{f(ohlcv.low)}</span></span>
            <span className="text-gray-400">收 <span className={ohlcv.isUp ? 'text-green-400' : 'text-red-400'}>{f(ohlcv.close)}</span></span>
            {ohlcv.volume != null && <span className="text-gray-400">量 <span className="text-blue-400">{fv(ohlcv.volume)}</span></span>}
          </>
        ) : (
          <span className="text-gray-600">移動滑鼠查看 OHLCV 資料</span>
        )}
      </div>

      {/* 圖表 + SVG 覆蓋層 */}
      <div className="relative"
        onMouseDown={activeTool !== 'cursor' ? handleMouseDown : undefined}
        onMouseMove={activeTool !== 'cursor' ? handleMouseMove : undefined}
        onMouseUp={activeTool !== 'cursor' ? handleMouseUp : undefined}
        style={{ cursor: activeTool !== 'cursor' ? 'crosshair' : 'default' }}
      >
        {(loading || error) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/80 rounded">
            {loading
              ? <span className="flex items-center gap-2 text-gray-400 text-sm"><RefreshCw className="w-4 h-4 animate-spin" />載入中...</span>
              : <span className="text-gray-500 text-sm">{error}</span>
            }
          </div>
        )}

        {/* lightweight-charts 容器 */}
        <div ref={containerRef} className="w-full rounded overflow-hidden" />

        {/* SVG 覆蓋層畫線 */}
        <svg
          ref={svgRef}
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        >
          {drawings.map(d => renderDrawing(d))}
          {isDrawing && tempPoint && drawStateRef.current.startPoint && renderDrawing({
            id: 'temp',
            type: activeTool,
            start: drawStateRef.current.startPoint,
            end: tempPoint,
            color: '#60a5fa',
          }, true)}
        </svg>
      </div>

      {/* 圖例 */}
      <div className="flex items-center gap-4 pt-2">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-green-500" /><span className="text-xs text-gray-500">漲</span></div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-500" /><span className="text-xs text-gray-500">跌</span></div>
        {showMA20 && <div className="flex items-center gap-1"><div className="w-4 h-0.5 bg-yellow-400" /><span className="text-xs text-gray-500">MA20</span></div>}
        {showMA60 && <div className="flex items-center gap-1"><div className="w-4 h-0.5 bg-purple-400" /><span className="text-xs text-gray-500">MA60</span></div>}
        <span className="text-xs text-gray-600 ml-auto">游標模式可縮放平移</span>
      </div>
    </div>
  )
}
