import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "")

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: { user } } = token
    ? await admin.auth.getUser(token)
    : { data: { user: null } }

  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { email, nome, password } = await req.json()
  if (!email || !nome || !password) return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 })

  const { data, error } = await admin.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { nome },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, userId: data.user?.id })
}
