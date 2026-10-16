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
import HeroGenerator3D from './pages/HeroGenerator3D'
import Model3DManager from './pages/admin/Model3DManager'
import { SHOW_CLASSIC_2D } from './config/features'

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
              <Route path="/generator" element={<HeroGenerator3D />} />
              {/* the old address of the 3D page */}
              <Route path="/generator/3d" element={<Navigate to="/generator" replace />} />
              {SHOW_CLASSIC_2D && <Route path="/generator/classic" element={<HeroGenerator />} />}
            </Route>

            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<Model3DManager />} />
              <Route path="/admin/3d" element={<Navigate to="/admin" replace />} />
              {SHOW_CLASSIC_2D && <Route path="/admin/classic" element={<HeroModelManager />} />}
              <Route path="/admin/backgrounds" element={<BackgroundManager />} />
              <Route path="/admin/team" element={<TeamManager />} />
            </Route>

            {/* anything else (including a bookmark to a page that is switched off) goes home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
