import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-300',
  secondary: 'bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50 disabled:text-zinc-300 disabled:bg-white',
  danger: 'bg-white text-red-600 border border-transparent hover:bg-red-50 disabled:text-zinc-300',
}

export default function Button({ variant = 'primary', loading = false, disabled, children, className = '', ...props }) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}
