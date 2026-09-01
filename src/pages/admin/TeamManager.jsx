import { useEffect, useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
import { listUsers, createUser } from '../../api/auth'
import Button from '../../components/Button'

export default function TeamManager() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('Generator')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      setUsers(await listUsers())
    } catch {
      setError('Failed to load team.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await createUser(email, password, role)
      setEmail('')
      setPassword('')
      setRole('Generator')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-900">Team</h1>
        <p className="text-sm text-zinc-500 mt-1">Give team members access — Admin can manage models, Generator can only generate hero shots.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-6 mb-8 flex flex-col gap-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="col-span-1 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>
          <div className="col-span-1 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-600">Password</label>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>
          <div className="col-span-1 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-600">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            >
              <option value="Generator">Generator</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div>
          <Button type="submit" loading={saving}>
            <UserPlus className="w-4 h-4" /> Add team member
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-400 text-sm py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 border border-zinc-200 rounded-lg px-4 py-3 bg-white">
              <span className="text-sm text-zinc-900 truncate min-w-0">{u.email}</span>
              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${u.role === 'Admin' ? 'bg-indigo-50 text-indigo-700' : 'bg-zinc-100 text-zinc-600'}`}>
                {u.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
