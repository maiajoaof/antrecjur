import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { analyzePdfBuffer } from "@/lib/analyzer"

export async function POST(req: NextRequest) {
  // Valida sessão via Authorization header enviado pelo cliente
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.replace("Bearer ", "")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verifica o token do usuário
  const { data: { user }, error: authError } = token
    ? await supabase.auth.getUser(token)
    : { data: { user: null }, error: null }

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  }

  const { processoId } = await req.json()
  if (!processoId) return NextResponse.json({ error: "processoId obrigatório" }, { status: 400 })

  const { data: processo } = await supabase.from("processos").select("*").eq("id", processoId).single()
  if (!processo) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 })
  if (!processo.pdf_url) return NextResponse.json({ error: "Processo sem PDF" }, { status: 400 })

  await supabase.from("processos").update({ status: "processando" }).eq("id", processoId)

  try {
    const pdfResp = await fetch(processo.pdf_url)
    if (!pdfResp.ok) throw new Error("Não foi possível baixar o PDF")
    const pdfBuffer = Buffer.from(await pdfResp.arrayBuffer())

    const extracted = await analyzePdfBuffer(pdfBuffer)

    await supabase.from("processos").update({
      status: "analisado",
      ...extracted,
      erro_msg: null,
    }).eq("id", processoId)

    const dadosLog: Record<string, unknown> = extracted as unknown as Record<string, unknown>
    await supabase.from("audit_log").insert({
      user_id: user.id, acao: "analisar", tabela: "processos",
      registro_id: processoId, dados: dadosLog
    })

    return NextResponse.json({ ok: true, data: extracted })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido"
    await supabase.from("processos").update({ status: "erro", erro_msg: msg }).eq("id", processoId)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
