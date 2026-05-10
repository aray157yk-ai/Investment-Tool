import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronLeft, ChevronRight, X, RefreshCw } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const fmt = (n) => new Intl.NumberFormat('zh-TW').format(Math.round(n || 0))

const ECONOMIC_EVENTS = {
  '01-03': [{ name: '非農就業 (NFP)', type: 'us' }],
  '02-07': [{ name: '非農就業 (NFP)', type: 'us' }],
  '03-07': [{ name: '非農就業 (NFP)', type: 'us' }],
  '04-04': [{ name: '非農就業 (NFP)', type: 'us' }],
  '05-02': [{ name: '非農就業 (NFP)', type: 'us' }],
  '06-06': [{ name: '非農就業 (NFP)', type: 'us' }],
  '07-04': [{ name: '非農就業 (NFP)', type: 'us' }],
  '08-01': [{ name: '非農就業 (NFP)', type: 'us' }],
  '09-05': [{ name: '非農就業 (NFP)', type: 'us' }],
  '10-03': [{ name: '非農就業 (NFP)', type: 'us' }],
  '11-07': [{ name: '非農就業 (NFP)', type: 'us' }],
  '12-05': [{ name: '非農就業 (NFP)', type: 'us' }],
  '01-15': [{ name: 'CPI 通膨數據', type: 'us' }],
  '02-12': [{ name: 'CPI 通膨數據', type: 'us' }],
  '03-12': [{ name: 'CPI 通膨數據', type: 'us' }],
  '04-10': [{ name: 'CPI 通膨數據', type: 'us' }],
  '05-13': [{ name: 'CPI 通膨數據', type: 'us' }],
  '06-11': [{ name: 'CPI 通膨數據', type: 'us' }],
  '07-15': [{ name: 'CPI 通膨數據', type: 'us' }],
  '08-13': [{ name: 'CPI 通膨數據', type: 'us' }],
  '09-10': [{ name: 'CPI 通膨數據', type: 'us' }],
  '10-15': [{ name: 'CPI 通膨數據', type: 'us' }],
  '11-13': [{ name: 'CPI 通膨數據', type: 'us' }],
  '12-10': [{ name: 'CPI 通膨數據', type: 'us' }],
  '01-29': [{ name: 'FOMC 利率決議', type: 'fed' }],
  '03-19': [{ name: 'FOMC 利率決議', type: 'fed' }],
  '05-07': [{ name: 'FOMC 利率決議', type: 'fed' }],
  '06-18': [{ name: 'FOMC 利率決議', type: 'fed' }],
  '07-29': [{ name: 'FOMC 利率決議', type: 'fed' }],
  '09-16': [{ name: 'FOMC 利率決議', type: 'fed' }],
  '11-05': [{ name: 'FOMC 利率決議', type: 'fed' }],
  '12-16': [{ name: 'FOMC 利率決議', type: 'fed' }],
}

const EVENT_COLORS = {
  us:  'bg-blue-900/70 text-blue-300',
  fed: 'bg-purple-900/70 text-purple-300',
}

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [records, setRecords] = useState({})
  const [showModal, setShowModal] = useState(null)
  const [pnlInput, setPnlInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordMsg, setRecordMsg] = useState('')

  useEffect(() => { fetchRecords() }, [year, month])

  const fetchRecords = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const end = `${year}-${String(month + 1).padStart(2, '0')}-31`
    const { data } = await supabase
      .from('calendar_records')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)
    const map = {}
    ;(data || []).forEach(r => { map[r.date] = r })
    setRecords(map)
  }

  const openModal = (dateStr) => {
    const existing = records[dateStr]
    setPnlInput(existing?.unrealized_pnl?.toString() || '')
    setNoteInput(existing?.note || '')
    setShowModal(dateStr)
  }

  const saveRecord = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // 手動記錄時也嘗試計算總資產
    let totalAssets = 0
    try {
      const { data: accs } = await supabase.from('accounts').select('cash_balance').eq('user_id', user.id)
      const { data: holds } = await supabase.from('stock_holdings').select('shares,avg_cost').eq('user_id', user.id)
      const cash = (accs || []).reduce((s, a) => s + (a.cash_balance || 0), 0)
      const stocks = (holds || []).reduce((s, h) => s + h.shares * parseFloat(h.avg_cost), 0)
      totalAssets = Math.round(cash + stocks)
    } catch {}
    // 計算當日損益（手動輸入時也計算）
    const modalDate = new Date(showModal)
    const prevDate = new Date(modalDate)
    prevDate.setDate(prevDate.getDate() - 1)
    const prevDateStr = prevDate.toISOString().slice(0, 10)
    const { data: prevRecord } = await supabase
      .from('calendar_records')
      .select('unrealized_pnl')
      .eq('user_id', user.id)
      .eq('date', prevDateStr)
      .single()
    const prevPnl = prevRecord?.unrealized_pnl || 0
    const manualDailyPnl = (parseFloat(pnlInput) || 0) - prevPnl

    await supabase.from('calendar_records').upsert({
      user_id: user.id,
      date: showModal,
      unrealized_pnl: parseFloat(pnlInput) || 0,
      daily_pnl: manualDailyPnl,
      total_assets: totalAssets || undefined,
      note: noteInput,
    }, { onConflict: 'user_id,date' })
    setShowModal(null)
    fetchRecords()
  }

  // 前端計算今日損益並記錄
  const autoRecordToday = async () => {
    setRecording(true)
    setRecordMsg('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setRecordMsg('❌ 請先登入'); setRecording(false); return }

      const { data: holdings } = await supabase
        .from('stock_holdings')
        .select('*')
        .eq('user_id', user.id)

      if (!holdings?.length) {
        setRecordMsg('⚠️ 目前無持股')
        setRecording(false)
        setTimeout(() => setRecordMsg(''), 3000)
        return
      }

      const symbols = [...new Set(holdings.map(h => h.symbol))].join(',')
      const res = await fetch(`${API}/api/prices?symbols=${symbols}`)
      const priceData = await res.json()

      let totalPnl = 0
      for (const h of holdings) {
        const p = priceData[h.symbol]
        if (!p || p.error || !p.price) continue
        const pnl = (p.price - parseFloat(h.avg_cost)) * h.shares
        totalPnl += h.is_short ? -pnl : pnl
      }

      // 計算總資產 = 所有帳戶現金 + 持股市值
      const { data: accountsData } = await supabase
        .from('accounts').select('cash_balance').eq('user_id', user.id)
      const totalCash = (accountsData || []).reduce((s, a) => s + (a.cash_balance || 0), 0)
      const totalStockValue = holdings.reduce((s, h) => {
        const p = priceData[h.symbol]
        if (!p || p.error || !p.price) return s + h.shares * parseFloat(h.avg_cost)
        return s + h.shares * p.price
      }, 0)
      const totalAssets = Math.round(totalCash + totalStockValue)

      const todayStr = new Date().toISOString().slice(0, 10)

      // 取昨天的未實現損益來計算當日損益
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().slice(0, 10)
      const { data: yesterdayRecord } = await supabase
        .from('calendar_records')
        .select('unrealized_pnl')
        .eq('user_id', user.id)
        .eq('date', yesterdayStr)
        .single()
      const yesterdayPnl = yesterdayRecord?.unrealized_pnl || 0
      const dailyPnl = Math.round(totalPnl) - yesterdayPnl

      await supabase.from('calendar_records').upsert({
        user_id: user.id,
        date: todayStr,
        unrealized_pnl: Math.round(totalPnl),
        daily_pnl: dailyPnl,
        total_assets: totalAssets,
        note: '系統自動記錄',
      }, { onConflict: 'user_id,date' })

      setRecordMsg(`✅ 今日損益已記錄　當日：${dailyPnl >= 0 ? '+' : ''}${fmt(dailyPnl)} 元　累積：${totalPnl >= 0 ? '+' : ''}${fmt(totalPnl)} 元`)
      fetchRecords()
    } catch (e) {
      setRecordMsg('❌ 失敗，請確認後端已啟動')
    }
    setRecording(false)
    setTimeout(() => setRecordMsg(''), 5000)
  }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = new Date(year, month).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const getEvents = (day) => {
    if (!day) return []
    const mmdd = `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return ECONOMIC_EVENTS[mmdd] || []
  }

  const days = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  const todayStr = today.toISOString().slice(0, 10)

  return (
    <div className="p-6 space-y-4">

      {/* 標題列 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">損益日曆</h1>
          {recordMsg && (
            <p className={`text-sm mt-0.5 ${recordMsg.startsWith('✅') ? 'text-green-400' : recordMsg.startsWith('⚠') ? 'text-amber-400' : 'text-red-400'}`}>
              {recordMsg}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={autoRecordToday}
            disabled={recording}
            className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recording ? 'animate-spin' : ''}`} />
            {recording ? '計算中...' : '記錄今日損益'}
          </button>
          <div className="w-px h-5 bg-gray-700" />
          <button onClick={prevMonth} className="text-gray-400 hover:text-white p-1 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-white font-medium w-36 text-center">{monthName}</span>
          <button onClick={nextMonth} className="text-gray-400 hover:text-white p-1 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 圖例 */}
      <div className="flex items-center gap-4 text-xs flex-wrap">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /><span className="text-gray-400">美國經濟數據</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /><span className="text-gray-400">FOMC 會議</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /><span className="text-gray-400">獲利</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /><span className="text-gray-400">虧損</span></div>
        <span className="text-gray-600">· 點擊日期可手動輸入損益 · 經濟數據日期僅供參考</span>
      </div>

      {/* 星期標題 */}
      <div className="grid grid-cols-7 gap-1">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => (
          <div key={d} className="text-center text-xs text-gray-500 py-2">{d}</div>
        ))}
      </div>

      {/* 日曆格子 */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const record = records[dateStr]
          const pnl = record?.unrealized_pnl
          const isToday = dateStr === todayStr
          const isPos = pnl > 0
          const isNeg = pnl < 0
          const events = getEvents(day)

          return (
            <div
              key={day}
              onClick={() => openModal(dateStr)}
              className={`min-h-20 rounded-lg p-1.5 cursor-pointer transition-colors border ${
                isToday ? 'border-blue-500' : 'border-transparent'
              } ${
                (record?.daily_pnl > 0 || (!record?.daily_pnl && isPos)) ? 'bg-green-900/20 hover:bg-green-900/30' :
                (record?.daily_pnl < 0 || (!record?.daily_pnl && isNeg)) ? 'bg-red-900/20 hover:bg-red-900/30' :
                'bg-gray-900 hover:bg-gray-800'
              }`}
            >
              <div className={`text-xs font-medium mb-0.5 ${isToday ? 'text-blue-400' : 'text-gray-400'}`}>
                {day}
              </div>
              {events.map((ev, ei) => (
                <div key={ei} className={`text-xs px-1 py-0.5 rounded mb-0.5 truncate leading-tight ${EVENT_COLORS[ev.type] || ''}`}>
                  {ev.name}
                </div>
              ))}
              {record?.daily_pnl !== undefined && record?.daily_pnl !== null ? (
                <div className={`text-xs font-semibold mt-0.5 ${record.daily_pnl > 0 ? 'text-green-400' : record.daily_pnl < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {record.daily_pnl > 0 ? '+' : ''}{fmt(record.daily_pnl)}
                </div>
              ) : pnl !== undefined && pnl !== null && (
                <div className={`text-xs font-semibold mt-0.5 ${isPos ? 'text-green-400' : isNeg ? 'text-red-400' : 'text-gray-500'}`}>
                  {isPos ? '+' : ''}{fmt(pnl)}
                </div>
              )}
              {record?.note && record.note !== '系統自動記錄' && (
                <div className="text-gray-600 text-xs mt-0.5 truncate">{record.note}</div>
              )}
            </div>
          )
        })}
      </div>

      {/* 記錄 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">{showModal}</h3>
              <button onClick={() => setShowModal(null)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* 當天事件 */}
            {(() => {
              const d = parseInt(showModal.split('-')[2])
              const evs = getEvents(d)
              return evs.length > 0 ? (
                <div className="mb-3 space-y-1">
                  {evs.map((ev, i) => (
                    <div key={i} className={`text-xs px-2 py-1 rounded ${EVENT_COLORS[ev.type] || ''}`}>{ev.name}</div>
                  ))}
                </div>
              ) : null
            })()}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">未實現損益（元）</label>
                <input
                  type="number"
                  value={pnlInput}
                  onChange={e => setPnlInput(e.target.value)}
                  placeholder="正數獲利，負數虧損"
                  autoFocus
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">備註</label>
                <input
                  type="text"
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder="今日市場狀況..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={saveRecord}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
