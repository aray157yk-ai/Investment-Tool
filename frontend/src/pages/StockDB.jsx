import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, ChevronDown, ChevronUp, X, RefreshCw } from 'lucide-react'
import StockSearch from '../components/StockSearch'

const fmt = (n) => new Intl.NumberFormat('zh-TW').format(Math.round(n || 0))
const pct = (n) => (n >= 0 ? '+' : '') + parseFloat(n || 0).toFixed(2) + '%'
const delayTag = (source) => {
  if (!source) return null
  if (source === 'yfinance_delayed') return <span className="text-xs bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded">延遲15分</span>
  return <span className="text-xs bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded">即時</span>
}
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function StockDB() {
  const [holdings, setHoldings] = useState([])
  const [accounts, setAccounts] = useState([])
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [priceLoading, setPriceLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showSellModal, setShowSellModal] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [form, setForm] = useState({ symbol: '', name: '', shares: '', price: '', fee: '', trade_type: '現股', account_id: '', buy_reason: '', sell_condition: '' })
  const [sellForm, setSellForm] = useState({ shares: '', price: '', fee: '', tax: '', note: '' })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [h, a] = await Promise.all([
      supabase.from('stock_holdings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at'),
    ])
    const holdingList = h.data || []
    const accountList = a.data || []
    setHoldings(holdingList)
    setAccounts(accountList)
    setLoading(false)
    if (holdingList.length > 0) fetchPrices(holdingList)
  }

  const fetchPrices = useCallback(async (holdingList) => {
    if (!holdingList?.length) return
    setPriceLoading(true)
    const symbols = [...new Set(holdingList.map(h => h.symbol))].join(',')
    try {
      const res = await fetch(`${API}/api/prices?symbols=${symbols}`)
      const data = await res.json()
      setPrices(data)
    } catch (e) { console.error('後端未啟動', e) }
    setPriceLoading(false)
  }, [])

  const calcPnl = (h) => {
    const p = prices[h.symbol]
    if (!p || p.error) return null
    const currentValue = h.shares * p.price
    const costValue = h.shares * h.avg_cost
    // 做空時：成本是放空價，現價漲 = 虧損，現價跌 = 獲利
    const pnl = h.is_short
      ? (costValue - currentValue)   // 放空：賣出價 - 現價
      : (currentValue - costValue)   // 做多：現價 - 買入價
    const pnlPct = (pnl / costValue) * 100
    return { currentValue, costValue, pnl, pnlPct, price: p.price, dailyChange: p.daily_change, source: p.source }
  }

  const totalUnrealized = holdings.reduce((s, h) => s + (calcPnl(h)?.pnl || 0), 0)
  const [editingNote, setEditingNote] = useState(null) // { id, buy_reason, sell_condition }

  const saveNote = async () => {
    if (!editingNote) return
    await supabase.from('stock_holdings').update({
      buy_reason: editingNote.buy_reason,
      sell_condition: editingNote.sell_condition,
      updated_at: new Date().toISOString()
    }).eq('id', editingNote.id)
    setEditingNote(null)
    fetchAll()
  }

  const handleBuy = async () => {
    if (!form.symbol || !form.shares || !form.price || !form.account_id) {
      alert('請填寫股票代號、股數、價格和帳戶')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const shares = parseInt(form.shares)
    const price = parseFloat(form.price)
    const fee = parseFloat(form.fee) || Math.round(shares * price * 0.001425)
    const isShort = form.trade_type === '融券'

    // 直接從資料庫取最新帳戶餘額（避免 state 快取問題）
    const { data: freshAccount } = await supabase
      .from('accounts').select('*').eq('id', form.account_id).single()
    if (!freshAccount) { alert('找不到帳戶'); return }

    const totalCost = shares * price + fee
    if (!isShort && freshAccount.cash_balance < totalCost) {
      alert(`現金不足！需要 ${fmt(totalCost)} 元，帳戶只有 ${fmt(freshAccount.cash_balance)} 元`)
      return
    }

    // 直接查資料庫找是否已有同股同帳戶同類型持股
    const { data: existingList } = await supabase
      .from('stock_holdings')
      .select('*')
      .eq('user_id', user.id)
      .eq('account_id', form.account_id)
      .eq('symbol', form.symbol)
      .eq('trade_type', form.trade_type)
      .eq('is_short', isShort)

    const existing = existingList?.[0]

    if (existing) {
      // 均攤
      const newShares = existing.shares + shares
      const newAvgCost = (existing.shares * parseFloat(existing.avg_cost) + shares * price) / newShares
      await supabase.from('stock_holdings').update({
        shares: newShares,
        avg_cost: newAvgCost,
        updated_at: new Date().toISOString()
      }).eq('id', existing.id)
    } else {
      // 新增持股
      await supabase.from('stock_holdings').insert({
        user_id: user.id,
        account_id: form.account_id,
        symbol: form.symbol,
        name: form.name,
        shares,
        avg_cost: price,
        trade_type: form.trade_type,
        is_short: isShort,
        buy_reason: form.buy_reason,
        sell_condition: form.sell_condition,
      })
    }

    // 交易紀錄
    await supabase.from('stock_transactions').insert({
      user_id: user.id,
      account_id: form.account_id,
      symbol: form.symbol,
      name: form.name,
      action: 'buy',
      shares, price, fee,
      trade_type: form.trade_type,
    })

    // 更新帳戶餘額
    const cashChange = isShort ? (shares * price - fee) : -(shares * price + fee)
    await supabase.from('accounts').update({
      cash_balance: freshAccount.cash_balance + cashChange
    }).eq('id', form.account_id)

    // 重置表單並重新載入
    setShowModal(false)
    setForm({ symbol: '', name: '', shares: '', price: '', fee: '', trade_type: '現股', account_id: '', buy_reason: '', sell_condition: '' })
    await fetchAll()
  }

  const handleSell = async () => {
    if (!sellForm.shares || !sellForm.price) return
    const h = showSellModal
    const { data: { user } } = await supabase.auth.getUser()
    const sellShares = parseInt(sellForm.shares), sellPrice = parseFloat(sellForm.price)
    if (sellShares > h.shares) { alert(`超過庫存 ${h.shares} 股`); return }
    const fee = parseFloat(sellForm.fee) || Math.round(sellShares * sellPrice * 0.001425)
    const tax = parseFloat(sellForm.tax) || Math.round(sellShares * sellPrice * 0.003)
    const totalRevenue = sellShares * sellPrice - fee - tax
    const totalCost = sellShares * h.avg_cost
    // 做空（融券）回補：獲利 = 放空價 - 回補價
    const profitLoss = h.is_short
      ? (totalCost - (sellShares * sellPrice + fee + tax))
      : (totalRevenue - totalCost)
    const account = accounts.find(a => a.id === h.account_id)

    if (sellShares === h.shares) {
      await supabase.from('realized_records').insert({ user_id: user.id, account_id: h.account_id, symbol: h.symbol, name: h.name, shares: sellShares, avg_cost: h.avg_cost, sell_price: sellPrice, total_cost: totalCost, total_revenue: totalRevenue, profit_loss: profitLoss, return_rate: (profitLoss / totalCost) * 100, fee, tax, buy_reason: h.buy_reason, sell_date: new Date().toISOString().slice(0, 10), is_short: h.is_short || false })
      await supabase.from('stock_holdings').delete().eq('id', h.id)
    } else {
      await supabase.from('stock_holdings').update({ shares: h.shares - sellShares, updated_at: new Date().toISOString() }).eq('id', h.id)
    }
    await supabase.from('stock_transactions').insert({ user_id: user.id, account_id: h.account_id, symbol: h.symbol, name: h.name, action: 'sell', shares: sellShares, price: sellPrice, fee, tax, trade_type: h.trade_type, note: sellForm.note })
    await supabase.from('accounts').update({ cash_balance: (account?.cash_balance || 0) + totalRevenue }).eq('id', h.account_id)
    setShowSellModal(null)
    setSellForm({ shares: '', price: '', fee: '', tax: '', note: '' })
    fetchAll()
  }

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">載入中...</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">股票資料庫</h1>
          {Object.keys(prices).length > 0 && (
            <p className={`text-sm mt-0.5 ${totalUnrealized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              未實現損益合計：{totalUnrealized >= 0 ? '+' : ''}{fmt(totalUnrealized)} 元
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchPrices(holdings)} disabled={priceLoading || !holdings.length}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white border border-gray-700 px-3 py-2 rounded-lg text-sm transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${priceLoading ? 'animate-spin' : ''}`} />
            {priceLoading ? '更新中' : '更新股價'}
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            <Plus className="w-4 h-4" /> 買入
          </button>
        </div>
      </div>

      {holdings.length > 0 && !Object.keys(prices).length && !priceLoading && (
        <div className="bg-amber-900/20 border border-amber-700/50 text-amber-400 text-sm px-4 py-2.5 rounded-lg">
          ⚠️ 無法取得即時股價，請確認後端已啟動
        </div>
      )}

      {holdings.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-500">尚無庫存，點右上角「買入」開始記錄</div>
      ) : (
        <div className="space-y-2">
          {holdings.map(h => {
            const pd = calcPnl(h)
            const isExpanded = expandedId === h.id
            const acc = accounts.find(a => a.id === h.account_id)
            return (
              <div key={h.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : h.id)}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-base">{h.symbol}</span>
                        {h.name && <span className="text-gray-500 text-sm">{h.name}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${h.trade_type === '融資' ? 'bg-amber-900/40 text-amber-400' : h.is_short ? 'bg-red-900/40 text-red-400' : 'bg-blue-900/40 text-blue-400'}`}>{h.is_short ? '融券（空）' : h.trade_type}</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">{acc?.name}</div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <div className="text-xs text-gray-500">即時價 / 日漲跌</div>
                        {pd ? <div className="flex items-center gap-1 flex-wrap">{delayTag(pd.source)}<span className="text-white">{pd.price.toFixed(2)}</span><span className={`text-xs ${pd.dailyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pct(pd.dailyChange)}</span></div> : <div className="text-gray-600">—</div>}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">均攤成本 / 股數</div>
                        <div className="text-white">{parseFloat(h.avg_cost).toFixed(2)} <span className="text-gray-500 text-xs">× {h.shares.toLocaleString()}</span></div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">未實現損益</div>
                        {pd ? (
                          <div>
                            <div className={`font-semibold ${pd.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pd.pnl >= 0 ? '+' : ''}{fmt(pd.pnl)}</div>
                            <div className={`text-xs ${pd.pnlPct >= 0 ? 'text-green-500' : 'text-red-500'}`}>{pct(pd.pnlPct)}</div>
                          </div>
                        ) : <div className="text-gray-600">—</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setShowSellModal(h); setSellForm({ shares: '', price: pd?.price?.toFixed(2) || '', fee: '', tax: '', note: '' }) }}
                          className="bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800 px-3 py-1.5 rounded-lg text-xs transition-colors">賣出</button>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500 cursor-pointer" onClick={() => setExpandedId(null)} /> : <ChevronDown className="w-4 h-4 text-gray-500 cursor-pointer" onClick={() => setExpandedId(h.id)} />}
                      </div>
                    </div>
                  </div>
                  {pd && <div className="mt-1.5 text-xs text-gray-600">成本 {fmt(pd.costValue)} ｜ 市值 {fmt(pd.currentValue)}</div>}
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-800 px-4 py-3 bg-gray-950 space-y-3">
                    {editingNote?.id === h.id ? (
                      // 編輯模式
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">買入原因</label>
                          <textarea rows={2} value={editingNote.buy_reason}
                            onChange={e => setEditingNote(p => ({ ...p, buy_reason: e.target.value }))}
                            placeholder="為何買入此股票..."
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">賣出條件</label>
                          <textarea rows={2} value={editingNote.sell_condition}
                            onChange={e => setEditingNote(p => ({ ...p, sell_condition: e.target.value }))}
                            placeholder="什麼情況會賣出..."
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveNote}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors">
                            儲存
                          </button>
                          <button onClick={() => setEditingNote(null)}
                            className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-1.5 rounded-lg text-xs transition-colors">
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      // 顯示模式
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">買入原因</p>
                          <p className="text-sm text-gray-300">{h.buy_reason || <span className="text-gray-600">（未填寫）</span>}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">賣出條件</p>
                          <p className="text-sm text-gray-300">{h.sell_condition || <span className="text-gray-600">（未填寫）</span>}</p>
                        </div>
                        <button
                          onClick={() => setEditingNote({ id: h.id, buy_reason: h.buy_reason || '', sell_condition: h.sell_condition || '' })}
                          className="text-xs text-gray-500 hover:text-blue-400 transition-colors underline underline-offset-2">
                          編輯買入賣出原因
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 買入 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">買入股票</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">搜尋股票 *</label>
                <StockSearch value={form.symbol} onChange={(symbol, name) => setForm(p => ({ ...p, symbol, name: name || p.name }))} placeholder="輸入代號或名稱，例如：2330、台積電" />
                {form.name && <p className="text-xs text-blue-400 mt-1 pl-1">{form.symbol} — {form.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">股數 *</label><input type="number" value={form.shares} onChange={e => setForm(p => ({ ...p, shares: e.target.value }))} placeholder="1000" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">買入價格 *</label><input type="number" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="100.00" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" /></div>
              </div>
              <div><label className="block text-xs text-gray-400 mb-1">手續費（留空自動算 0.1425%）</label><input type="number" value={form.fee} onChange={e => setForm(p => ({ ...p, fee: e.target.value }))} placeholder="自動計算" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" /></div>
              <div><label className="block text-xs text-gray-400 mb-1">帳戶 *</label>
                <select value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">選擇帳戶</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}（可用：{fmt(a.cash_balance)} 元）</option>)}
                </select>
              </div>
              <div><label className="block text-xs text-gray-400 mb-1">交易類型</label>
                <div className="flex gap-2">{['現股', '融資', '融券'].map(t => <button key={t} onClick={() => setForm(p => ({ ...p, trade_type: t }))} className={`flex-1 py-2 rounded-lg text-sm transition-colors ${form.trade_type === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{t}</button>)}</div>
              </div>
              <div><label className="block text-xs text-gray-400 mb-1">買入原因</label><textarea value={form.buy_reason} rows={2} onChange={e => setForm(p => ({ ...p, buy_reason: e.target.value }))} placeholder="為何買入..." className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" /></div>
              <div><label className="block text-xs text-gray-400 mb-1">賣出條件</label><textarea value={form.sell_condition} rows={2} onChange={e => setForm(p => ({ ...p, sell_condition: e.target.value }))} placeholder="什麼情況會賣出..." className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" /></div>
              {form.shares && form.price && <div className="bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300">預估總成本：<span className="text-white font-medium">{fmt(parseInt(form.shares || 0) * parseFloat(form.price || 0) + (parseFloat(form.fee) || Math.round(parseInt(form.shares || 0) * parseFloat(form.price || 0) * 0.001425)))} 元</span></div>}
              <button onClick={handleBuy} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">確認買入</button>
            </div>
          </div>
        </div>
      )}

      {/* 賣出 Modal */}
      {showSellModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-semibold">{showSellModal.is_short ? '回補（平空）' : '賣出'} {showSellModal.symbol}</h3>
              <button onClick={() => setShowSellModal(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">庫存：{showSellModal.shares} 股 ｜ 均攤成本：{parseFloat(showSellModal.avg_cost).toFixed(2)}</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">賣出股數 *</label><input autoFocus type="number" value={sellForm.shares} onChange={e => setSellForm(p => ({ ...p, shares: e.target.value }))} placeholder={`最多 ${showSellModal.shares}`} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">賣出價格 *</label><input type="number" step="0.01" value={sellForm.price} onChange={e => setSellForm(p => ({ ...p, price: e.target.value }))} placeholder="市價" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">手續費（留空自動）</label><input type="number" value={sellForm.fee} onChange={e => setSellForm(p => ({ ...p, fee: e.target.value }))} placeholder="0.1425%" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" /></div>
                <div><label className="block text-xs text-gray-400 mb-1">交易稅（留空自動）</label><input type="number" value={sellForm.tax} onChange={e => setSellForm(p => ({ ...p, tax: e.target.value }))} placeholder="現股 0.3%" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" /></div>
              </div>
              <div><label className="block text-xs text-gray-400 mb-1">備註</label><input type="text" value={sellForm.note} onChange={e => setSellForm(p => ({ ...p, note: e.target.value }))} placeholder="賣出原因..." className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" /></div>
              {sellForm.shares && sellForm.price && (() => {
                const s = parseInt(sellForm.shares), p2 = parseFloat(sellForm.price)
                const fee = parseFloat(sellForm.fee) || Math.round(s * p2 * 0.001425)
                const tax = parseFloat(sellForm.tax) || Math.round(s * p2 * 0.003)
                const revenue = s * p2 - fee - tax
                const cost = s * showSellModal.avg_cost
                const pl = revenue - cost
                return (
                  <div className={`rounded-lg px-3 py-3 text-sm border ${pl >= 0 ? 'bg-green-900/20 border-green-800/50' : 'bg-red-900/20 border-red-800/50'}`}>
                    <div className="flex justify-between mb-1"><span className="text-gray-400">扣費後收入</span><span className="text-white">{fmt(revenue)} 元</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">預估損益</span><span className={`font-semibold ${pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pl >= 0 ? '+' : ''}{fmt(pl)} 元（{(pl / cost * 100).toFixed(2)}%）</span></div>
                    {parseInt(sellForm.shares) === showSellModal.shares && <p className="text-xs text-amber-400 mt-1">⚠ 全數出清，將移入「紀錄」頁面</p>}
                  </div>
                )
              })()}
              <button onClick={handleSell} className="w-full bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">確認賣出</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
