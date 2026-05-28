import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { analyzePdfBuffer } from "@/lib/analyzer"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

export async function POST(req: NextRequest) {
  console.log("URL:", SUPABASE_URL ? "ok" : "MISSING")
  console.log("ANON:", ANON_KEY ? "ok" : "MISSING")
  console.log("SERVICE:", SERVICE_KEY ? "ok" : "MISSING")

  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.replace("Bearer ", "").trim()

  if (!token) return NextResponse.json({ error: "Token ausente" }, { status: 401 })
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    return NextResponse.json({ error: "Variáveis de ambiente não configuradas" }, { status: 500 })
  }

  // Valida o usuário com o token
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  console.log("user:", user?.id ?? "null", "authError:", authError?.message ?? "none")
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  // Admin client para banco
  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { processoId } = await req.json()
  if (!processoId) return NextResponse.json({ error: "processoId obrigatório" }, { status: 400 })

  const { data: processo, error: procError } = await db
    .from("processos").select("*").eq("id", processoId).single()
  console.log("processo:", processo?.id ?? "null", "procError:", procError?.message ?? "none")

  if (!processo) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 })
  if (!processo.pdf_url) return NextResponse.json({ error: "Processo sem PDF" }, { status: 400 })

  await db.from("processos").update({ status: "processando" }).eq("id", processoId)

  try {
    const pdfResp = await fetch(processo.pdf_url)
    if (!pdfResp.ok) throw new Error("Não foi possível baixar o PDF")
    const pdfBuffer = Buffer.from(await pdfResp.arrayBuffer())
    const extracted = await analyzePdfBuffer(pdfBuffer)

    await db.from("processos").update({ status: "analisado", ...extracted, erro_msg: null }).eq("id", processoId)
    await db.from("audit_log").insert({
      user_id: user.id, acao: "analisar", tabela: "processos",
      registro_id: processoId, dados: extracted as unknown as Record<string, unknown>
    })

    return NextResponse.json({ ok: true, data: extracted })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido"
    await db.from("processos").update({ status: "erro", erro_msg: msg }).eq("id", processoId)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
