import { NavLink, useNavigate } from 'react-router-dom'
import { Sparkles, LogOut } from 'lucide-react'
import { useAuth } from '../state/AuthContext'

const navLinkClass = ({ isActive }) =>
  `px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
    isActive ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
  }`

export default function Layout({ children }) {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-zinc-900 shrink-0 text-sm sm:text-base">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            Mobile Gadgets
          </div>

          {user && (
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <nav className="flex items-center gap-1 overflow-x-auto">
                <NavLink to="/generator" className={navLinkClass}>
                  Generator
                </NavLink>
                {isAdmin && (
                  <>
                    <NavLink to="/admin" end className={navLinkClass}>
                      Admin
                    </NavLink>
                    <NavLink to="/admin/backgrounds" className={navLinkClass}>
                      Backgrounds
                    </NavLink>
                    <NavLink to="/admin/team" className={navLinkClass}>
                      Team
                    </NavLink>
                  </>
                )}
              </nav>
              <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-zinc-200 shrink-0">
                <span className="hidden sm:inline text-xs text-zinc-500 truncate max-w-[10rem]">{user.email}</span>
                <button
                  onClick={handleLogout}
                  aria-label="Log out"
                  className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
