"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase-client"
import clsx from "clsx"

const NAV = [
  { href: "/dashboard",    label: "Dashboard",    icon: "📊" },
  { href: "/encontrar",    label: "Encontrar",    icon: "🔎" },
  { href: "/analisar",     label: "Analisar",     icon: "📋" },
  { href: "/acompanhar",   label: "Acompanhar",   icon: "🤝" },
  { href: "/admin",        label: "Admin",        icon: "⚙️" },
]

export default function Sidebar({ user }: { user: { email: string; nome: string } }) {
  const path = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Recebíveis</p>
        <h1 className="font-serif text-lg leading-tight text-white">Jurídicos</h1>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {NAV.map(({ href, label, icon }) => (
          <Link key={href} href={href} className={clsx(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
            path.startsWith(href)
              ? "bg-white text-slate-900"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          )}>
            <span className="text-base">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-white truncate">{user.nome}</p>
          <p className="text-xs text-slate-400 truncate">{user.email}</p>
        </div>
        <button onClick={signOut} className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
          Sair →
        </button>
      </div>
    </aside>
  )
}
