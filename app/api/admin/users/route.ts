import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerSupabase } from "@/lib/supabase-server"

export async function POST(req: NextRequest) {
  // Verifica se quem chama é autenticado
  const serverSupabase = createServerSupabase()
  const { data: { user } } = await serverSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { email, nome, password } = await req.json()
  if (!email || !nome || !password) return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 })

  // Admin client com service role para criar usuários
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await admin.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { nome },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, userId: data.user?.id })
}
