import { redirect } from "next/navigation"
import { createServerSupabase } from "@/lib/supabase-server"
import Sidebar from "@/components/layout/Sidebar"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase.from("profiles").select("nome, email").eq("id", user.id).single()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={{ email: profile?.email || user.email || "", nome: profile?.nome || "Usuário" }} />
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}
