import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle, X } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('zh-TW').format(Math.round(n || 0))

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showTransaction, setShowTransaction] = useState(null) // { accountId, type: 'deposit'|'withdraw' }
  const [newAccount, setNewAccount] = useState({ name: '', cash_balance: '', margin_limit: '', note: '' })
  const [txAmount, setTxAmount] = useState('')
  const [txNote, setTxNote] = useState('')

  useEffect(() => { fetchAccounts() }, [])

  const fetchAccounts = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at')
    setAccounts(data || [])
    setLoading(false)
  }

  const addAccount = async () => {
    if (!newAccount.name) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('accounts').insert({
      user_id: user.id,
      name: newAccount.name,
      cash_balance: parseFloat(newAccount.cash_balance) || 0,
      margin_limit: parseFloat(newAccount.margin_limit) || 0,
      note: newAccount.note,
    })
    setNewAccount({ name: '', cash_balance: '', margin_limit: '', note: '' })
    setShowAddAccount(false)
    fetchAccounts()
  }

  const deleteAccount = async (id) => {
    if (!confirm('確定刪除此帳戶？所有相關資料也會一併刪除。')) return
    await supabase.from('accounts').delete().eq('id', id)
    fetchAccounts()
  }

  const handleTransaction = async () => {
    if (!txAmount || !showTransaction) return
    const amount = parseFloat(txAmount)
    const { accountId, type } = showTransaction
    const account = accounts.find(a => a.id === accountId)
    const { data: { user } } = await supabase.auth.getUser()

    const newBalance = type === 'deposit'
      ? account.cash_balance + amount
      : account.cash_balance - amount

    if (type === 'withdraw' && newBalance < 0) {
      alert('現金不足，無法提出')
      return
    }

    await supabase.from('accounts').update({ cash_balance: newBalance }).eq('id', accountId)
    await supabase.from('account_transactions').insert({
      user_id: user.id,
      account_id: accountId,
      type,
      amount,
      note: txNote,
    })

    setShowTransaction(null)
    setTxAmount('')
    setTxNote('')
    fetchAccounts()
  }

  const totalCash = accounts.reduce((s, a) => s + (a.cash_balance || 0), 0)
  const totalMargin = accounts.reduce((s, a) => s + (a.margin_limit || 0), 0)

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400">載入中...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">帳戶管理</h1>
        <button
          onClick={() => setShowAddAccount(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> 新增帳戶
        </button>
      </div>

      {/* 總覽 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400 mb-1">所有帳戶現金合計</p>
          <p className="text-2xl font-bold text-white">{fmt(totalCash)} <span className="text-sm text-gray-500">元</span></p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400 mb-1">融資額度合計</p>
          <p className="text-2xl font-bold text-amber-400">{fmt(totalMargin)} <span className="text-sm text-gray-500">元</span></p>
        </div>
      </div>

      {/* 帳戶列表 */}
      <div className="space-y-4">
        {accounts.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-500">
            尚無帳戶，點右上角「新增帳戶」開始
          </div>
        ) : accounts.map(acc => (
          <div key={acc.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-white font-semibold text-lg">{acc.name}</h3>
                {acc.note && <p className="text-gray-500 text-sm mt-0.5">{acc.note}</p>}
              </div>
              <button
                onClick={() => deleteAccount(acc.id)}
                className="text-gray-600 hover:text-red-400 transition-colors p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">現金餘額</p>
                <p className="text-xl font-bold text-white">{fmt(acc.cash_balance)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">融資額度</p>
                <p className="text-xl font-bold text-amber-400">{fmt(acc.margin_limit)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">已使用融資</p>
                <p className="text-xl font-bold text-red-400">{fmt(acc.margin_used)}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowTransaction({ accountId: acc.id, type: 'deposit' })}
                className="flex items-center gap-1.5 bg-green-900/30 hover:bg-green-900/50 text-green-400 border border-green-800 px-3 py-1.5 rounded-lg text-sm transition-colors"
              >
                <ArrowDownCircle className="w-3.5 h-3.5" /> 存入
              </button>
              <button
                onClick={() => setShowTransaction({ accountId: acc.id, type: 'withdraw' })}
                className="flex items-center gap-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800 px-3 py-1.5 rounded-lg text-sm transition-colors"
              >
                <ArrowUpCircle className="w-3.5 h-3.5" /> 提出
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 新增帳戶 Modal */}
      {showAddAccount && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">新增帳戶</h3>
              <button onClick={() => setShowAddAccount(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: '帳戶名稱', key: 'name', placeholder: '例：中華電信帳戶', type: 'text' },
                { label: '初始現金餘額（元）', key: 'cash_balance', placeholder: '0', type: 'number' },
                { label: '融資額度（元）', key: 'margin_limit', placeholder: '0', type: 'number' },
                { label: '備註', key: 'note', placeholder: '選填', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-gray-400 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={newAccount[f.key]}
                    onChange={e => setNewAccount(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
              <button
                onClick={addAccount}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-medium mt-2 transition-colors"
              >
                建立帳戶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 存入/提出 Modal */}
      {showTransaction && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">
                {showTransaction.type === 'deposit' ? '存入資金' : '提出資金'}
              </h3>
              <button onClick={() => setShowTransaction(null)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">金額（元）</label>
                <input
                  type="number"
                  value={txAmount}
                  onChange={e => setTxAmount(e.target.value)}
                  placeholder="請輸入金額"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">備註（選填）</label>
                <input
                  type="text"
                  value={txNote}
                  onChange={e => setTxNote(e.target.value)}
                  placeholder="例：薪資入帳"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleTransaction}
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  showTransaction.type === 'deposit'
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
              >
                確認{showTransaction.type === 'deposit' ? '存入' : '提出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
