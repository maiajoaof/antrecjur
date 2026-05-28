import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { analyzePdfBuffer } from "@/lib/analyzer"

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "").trim()

  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  // Usa anon key + token do usuário para verificar sessão
  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()

  if (authError || !user) {
    console.error("Auth error:", authError?.message)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  // Admin client para operações no banco
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const body = await req.json()
  const { processoId } = body
  console.log("processoId recebido:", processoId)

  if (!processoId) return NextResponse.json({ error: "processoId obrigatório" }, { status: 400 })

  const { data: processo, error: procError } = await supabaseAdmin.from("processos").select("*").eq("id", processoId).single()
  console.log("processo encontrado:", processo?.id, "erro:", procError?.message)
  if (!processo) return NextResponse.json({ error: `Processo não encontrado (id: ${processoId})` }, { status: 404 })
  if (!processo.pdf_url) return NextResponse.json({ error: "Processo sem PDF" }, { status: 400 })

  await supabaseAdmin.from("processos").update({ status: "processando" }).eq("id", processoId)

  try {
    const pdfResp = await fetch(processo.pdf_url)
    if (!pdfResp.ok) throw new Error("Não foi possível baixar o PDF")
    const pdfBuffer = Buffer.from(await pdfResp.arrayBuffer())

    const extracted = await analyzePdfBuffer(pdfBuffer)

    await supabaseAdmin.from("processos").update({
      status: "analisado",
      ...extracted,
      erro_msg: null,
    }).eq("id", processoId)

    const dadosLog: Record<string, unknown> = extracted as unknown as Record<string, unknown>
    await supabaseAdmin.from("audit_log").insert({
      user_id: user.id, acao: "analisar", tabela: "processos",
      registro_id: processoId, dados: dadosLog
    })

    return NextResponse.json({ ok: true, data: extracted })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido"
    await supabaseAdmin.from("processos").update({ status: "erro", erro_msg: msg }).eq("id", processoId)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
