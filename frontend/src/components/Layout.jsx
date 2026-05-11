import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  LayoutDashboard, Database, Eye, FileText,
  Calendar, Wallet, TrendingUp, LogOut, Map
} from 'lucide-react'

const navItems = [
  { to: '/',            icon: LayoutDashboard, label: '資產配置' },
  { to: '/stocks',      icon: Database,         label: '股票資料庫' },
  { to: '/watchlist',   icon: Eye,              label: '觀察清單' },
  { to: '/industry',    icon: Map,              label: '產業地圖' },
  { to: '/records',     icon: FileText,         label: '紀錄' },
  { to: '/calendar',    icon: Calendar,         label: '日曆' },
  { to: '/accounts',    icon: Wallet,           label: '帳戶' },
]

export default function Layout({ session }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">

      {/* 側邊欄 */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-800">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-sm">投資管理工具</span>
        </div>

        {/* 導覽 */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* 底部：使用者 + 登出 */}
        <div className="border-t border-gray-800 p-3">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs text-gray-500 truncate">{session?.user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            登出
          </button>
        </div>
      </aside>

      {/* 主內容 */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <Outlet />
      </main>
    </div>
  )
}
