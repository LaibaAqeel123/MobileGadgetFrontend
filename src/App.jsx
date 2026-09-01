import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './state/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Login from './pages/Login'
import HeroGenerator from './pages/HeroGenerator'
import HeroModelManager from './pages/admin/HeroModelManager'
import TeamManager from './pages/admin/TeamManager'
import BackgroundManager from './pages/admin/BackgroundManager'

function RootRedirect() {
  const { status, isAdmin } = useAuth()
  if (status === 'loading') return null
  if (status === 'unauthenticated') return <Navigate to="/login" replace />
  return <Navigate to={isAdmin ? '/admin' : '/generator'} replace />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/generator" element={<HeroGenerator />} />
            </Route>

            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<HeroModelManager />} />
              <Route path="/admin/backgrounds" element={<BackgroundManager />} />
              <Route path="/admin/team" element={<TeamManager />} />
            </Route>
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
