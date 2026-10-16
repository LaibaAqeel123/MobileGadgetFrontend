import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './state/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Login from './pages/Login'
import HeroGenerator from './pages/HeroGenerator'
import HeroGenerator3D from './pages/HeroGenerator3D'
import HeroModelManager from './pages/admin/HeroModelManager'
import TeamManager from './pages/admin/TeamManager'
import BackgroundManager from './pages/admin/BackgroundManager'
import Model3DManager from './pages/admin/Model3DManager'

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
              <Route path="/generator/3d" element={<HeroGenerator3D />} />
            </Route>

            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<HeroModelManager />} />
              <Route path="/admin/3d" element={<Model3DManager />} />
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
