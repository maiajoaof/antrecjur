import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase-server"
import { analyzePdfBuffer } from "@/lib/analyzer"

export async function POST(req: NextRequest) {
  const supabase = createAdminSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { processoId } = await req.json()
  if (!processoId) return NextResponse.json({ error: "processoId obrigatório" }, { status: 400 })

  const { data: processo } = await supabase.from("processos").select("*").eq("id", processoId).single()
  if (!processo) return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 })
  if (!processo.pdf_url) return NextResponse.json({ error: "Processo sem PDF" }, { status: 400 })

  // Marca como processando
  await supabase.from("processos").update({ status: "processando" }).eq("id", processoId)

  try {
    // Baixa o PDF
    const pdfResp = await fetch(processo.pdf_url)
    if (!pdfResp.ok) throw new Error("Não foi possível baixar o PDF")
    const pdfBuffer = Buffer.from(await pdfResp.arrayBuffer())

    // Analisa com Claude
    const extracted = await analyzePdfBuffer(pdfBuffer)

    // Salva resultado
    await supabase.from("processos").update({
      status: "analisado",
      ...extracted,
      erro_msg: null,
    }).eq("id", processoId)

    // Audit log — cast seguro via unknown
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
