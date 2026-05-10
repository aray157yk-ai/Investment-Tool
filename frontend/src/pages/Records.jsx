import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('zh-TW').format(Math.round(n || 0))

export default function Records() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => { fetchRecords() }, [])

  const fetchRecords = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('realized_records')
      .select('*').eq('user_id', user.id).order('sell_date', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }

  const deleteRecord = async (id) => {
    if (!confirm('確定刪除此紀錄？')) return
    await supabase.from('realized_records').delete().eq('id', id)
    fetchRecords()
  }

  const totalPnl = records.reduce((s, r) => s + (r.profit_loss || 0), 0)
  const wins = records.filter(r => r.profit_loss > 0).length
  const winRate = records.length > 0 ? (wins / records.length * 100).toFixed(1) : 0

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">載入中...</div>

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-white">交易紀錄</h1>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">已實現總損益</p>
          <p className={`text-xl font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">總筆數</p>
          <p className="text-xl font-bold text-white">{records.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">勝率</p>
          <p className="text-xl font-bold text-blue-400">{winRate}%</p>
        </div>
      </div>

      {/* 紀錄列表 */}
      {records.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-500">
          尚無已實現損益紀錄，出清股票後會自動出現
        </div>
      ) : (
        <div className="space-y-2">
          {records.map(r => {
            const isExpanded = expandedId === r.id
            const isProfit = r.profit_loss >= 0
            return (
              <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="font-semibold text-white">{r.symbol}</span>
                      {r.name && <span className="text-gray-500 text-sm ml-2">{r.name}</span>}
                      <div className="text-xs text-gray-600 mt-0.5">{r.sell_date}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <div className="text-xs text-gray-500">損益</div>
                      <div className={`font-semibold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                        {isProfit ? '+' : ''}{fmt(r.profit_loss)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">報酬率</div>
                      <div className={`font-semibold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                        {isProfit ? '+' : ''}{parseFloat(r.return_rate).toFixed(2)}%
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteRecord(r.id) }}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-800 px-4 py-3 bg-gray-950">
                    <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                      <div><span className="text-gray-500">股數：</span><span className="text-white">{r.shares}</span></div>
                      <div><span className="text-gray-500">均攤成本：</span><span className="text-white">{parseFloat(r.avg_cost).toFixed(2)}</span></div>
                      <div><span className="text-gray-500">賣出價：</span><span className="text-white">{parseFloat(r.sell_price).toFixed(2)}</span></div>
                      <div><span className="text-gray-500">手續費：</span><span className="text-white">{fmt(r.fee)}</span></div>
                      <div><span className="text-gray-500">交易稅：</span><span className="text-white">{fmt(r.tax)}</span></div>
                      <div><span className="text-gray-500">股息：</span><span className="text-white">{fmt(r.dividend_income)}</span></div>
                    </div>
                    {r.buy_reason && <div className="mb-2"><p className="text-xs text-gray-500">買入原因</p><p className="text-sm text-gray-300">{r.buy_reason}</p></div>}
                    {r.review_note && <div><p className="text-xs text-gray-500">事後看法</p><p className="text-sm text-gray-300">{r.review_note}</p></div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
