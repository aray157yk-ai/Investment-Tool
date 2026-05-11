import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import StockDB from './pages/StockDB'
import Watchlist from './pages/Watchlist'
import IndustryMap from './pages/IndustryMap'
import Records from './pages/Records'
import CalendarPage from './pages/CalendarPage'
import Accounts from './pages/Accounts'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="text-white text-lg">載入中...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {!session ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <Route element={<Layout session={session} />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stocks" element={<StockDB />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/industry" element={<IndustryMap />} />
            <Route path="/records" element={<Records />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  )
}

export default App
