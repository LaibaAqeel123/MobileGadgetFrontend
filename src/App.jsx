import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import HeroGenerator from './pages/HeroGenerator'
import HeroModelManager from './pages/admin/HeroModelManager'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/generator" replace />} />
          <Route path="/generator" element={<HeroGenerator />} />
          <Route path="/admin" element={<HeroModelManager />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
