import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { TrendingUp } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('帳號或密碼錯誤')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('註冊成功！請檢查你的信箱驗證帳號，然後回來登入。')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="bg-blue-600 p-2.5 rounded-xl">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">投資管理工具</h1>
        </div>

        {/* 卡片 */}
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-6">
            {mode === 'login' ? '登入帳號' : '建立帳號'}
          </h2>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-900/30 border border-green-700 text-green-400 px-4 py-3 rounded-lg mb-4 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">電子郵件</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">密碼</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="至少 6 個字元"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium py-2.5 rounded-lg transition-colors mt-2"
            >
              {loading ? '處理中...' : mode === 'login' ? '登入' : '註冊'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setMessage('') }}
              className="text-sm text-gray-400 hover:text-blue-400 transition-colors"
            >
              {mode === 'login' ? '還沒有帳號？點此註冊' : '已有帳號？點此登入'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
