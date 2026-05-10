import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, BarChart2 } from 'lucide-react'

// 圓餅圖顏色
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

// 格式化金額
const fmt = (n) => new Intl.NumberFormat('zh-TW').format(Math.round(n || 0))

export default function Dashboard() {
  const [accounts, setAccounts] = useState([])
  const [holdings, setHoldings] = useState([])
  const [calendarData, setCalendarData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [accRes, holdRes, calRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id),
      supabase.from('stock_holdings').select('*').eq('user_id', user.id),
      supabase.from('calendar_records').select('*').eq('user_id', user.id).order('date', { ascending: true }).limit(30),
    ])

    setAccounts(accRes.data || [])
    setHoldings(holdRes.data || [])
    setCalendarData(calRes.data || [])
    setLoading(false)
  }

  // 計算各類總資產
  const totalCash = accounts.reduce((s, a) => s + (a.cash_balance || 0), 0)
  const totalMarginUsed = accounts.reduce((s, a) => s + (a.margin_used || 0), 0)
  const totalStockValue = holdings.reduce((s, h) => s + (h.shares * h.avg_cost), 0)
  const totalAssets = totalCash + totalStockValue

  // 資產配置圓餅圖資料
  const pieData = [
    { name: '現金', value: totalCash },
    { name: '現股', value: totalStockValue },
    { name: '融資', value: totalMarginUsed },
  ].filter(d => d.value > 0)

  // 成長線圖資料（來自日曆）
  const lineData = calendarData
    .filter(r => r.total_assets > 0)
    .map(r => ({
      date: r.date.slice(5),
      總資產: r.total_assets,
      損益: r.unrealized_pnl,
    }))

  // 計算日/週/月收益（用日曆最後幾筆）
  const lastPnl = calendarData[calendarData.length - 1]?.unrealized_pnl || 0
  const dayAgo = calendarData[calendarData.length - 2]?.unrealized_pnl || 0
  const weekAgo = calendarData[calendarData.length - 6]?.unrealized_pnl || 0
  const monthAgo = calendarData[0]?.unrealized_pnl || 0

  const statCards = [
    { label: '日收益', value: lastPnl - dayAgo, icon: TrendingUp },
    { label: '週收益', value: lastPnl - weekAgo, icon: BarChart2 },
    { label: '月收益', value: lastPnl - monthAgo, icon: TrendingDown },
    { label: '總資產', value: totalAssets, icon: DollarSign, noColor: true },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-full text-gray-400">載入中...</div>
  )

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-white">資產配置</h1>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, noColor }) => {
          const isPos = value >= 0
          return (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">{label}</span>
                <Icon className="w-4 h-4 text-gray-600" />
              </div>
              <p className={`text-xl font-bold ${noColor ? 'text-white' : isPos ? 'text-green-400' : 'text-red-400'}`}>
                {isPos && !noColor ? '+' : ''}{fmt(value)}
              </p>
            </div>
          )
        })}
      </div>

      {/* 圖表區 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 資產成長折線圖 */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-4">總資產走勢（近30日）</h2>
          {lineData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
              尚無資料，請點日曆頁的「記錄今日損益」按鈕
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={lineData}>
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#d1d5db' }}
                  itemStyle={{ color: '#60a5fa' }}
                  formatter={(v) => [fmt(v) + ' 元', '總資產']}
                />
                <Line type="monotone" dataKey="總資產" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 資產配置圓餅圖 */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-4">資產配置</h2>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
              尚無資產資料，請先設定帳戶
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    formatter={(v) => [fmt(v) + ' 元', '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {pieData.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                      <span className="text-sm text-gray-400">{item.name}</span>
                    </div>
                    <span className="text-sm text-white">{fmt(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 庫存股票倉位 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-gray-300 mb-4">庫存股票倉位</h2>
        {holdings.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">
            尚無庫存股票，請至「股票資料庫」買入股票
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left pb-2">股票</th>
                  <th className="text-right pb-2">股數</th>
                  <th className="text-right pb-2">平均成本</th>
                  <th className="text-right pb-2">市值（估）</th>
                  <th className="text-right pb-2">類型</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {holdings.map(h => {
                  const value = h.shares * h.avg_cost
                  const pct = totalStockValue > 0 ? (value / totalStockValue * 100).toFixed(1) : 0
                  return (
                    <tr key={h.id} className="text-gray-300">
                      <td className="py-2.5">
                        <span className="font-medium text-white">{h.symbol}</span>
                        {h.name && <span className="text-gray-500 ml-2 text-xs">{h.name}</span>}
                      </td>
                      <td className="text-right py-2.5">{h.shares.toLocaleString()}</td>
                      <td className="text-right py-2.5">{h.avg_cost.toFixed(2)}</td>
                      <td className="text-right py-2.5">
                        <div>{fmt(value)}</div>
                        <div className="text-xs text-gray-500">{pct}%</div>
                      </td>
                      <td className="text-right py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          h.trade_type === '融資' ? 'bg-amber-900/40 text-amber-400' :
                          h.trade_type === '融券' ? 'bg-red-900/40 text-red-400' :
                          'bg-blue-900/40 text-blue-400'
                        }`}>{h.trade_type}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
