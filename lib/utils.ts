export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    novo: "Novo",
    em_contato: "Em contato",
    proposta_enviada: "Proposta enviada",
    negociando: "Negociando",
    contrato_gerado: "Contrato gerado",
    fechado: "Fechado",
    rejeitado: "Rejeitado",
  }
  return labels[stage] || stage
}

export function stageColor(stage: string): string {
  const colors: Record<string, string> = {
    novo: "bg-slate-100 text-slate-700",
    em_contato: "bg-blue-100 text-blue-700",
    proposta_enviada: "bg-amber-100 text-amber-700",
    negociando: "bg-orange-100 text-orange-700",
    contrato_gerado: "bg-purple-100 text-purple-700",
    fechado: "bg-green-100 text-green-700",
    rejeitado: "bg-red-100 text-red-700",
  }
  return colors[stage] || "bg-gray-100 text-gray-700"
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    pendente: "bg-yellow-100 text-yellow-700",
    processando: "bg-blue-100 text-blue-700",
    analisado: "bg-green-100 text-green-700",
    erro: "bg-red-100 text-red-700",
  }
  return colors[status] || "bg-gray-100 text-gray-700"
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    processando: "Processando",
    analisado: "Analisado",
    erro: "Erro",
  }
  return labels[status] || status
}

export async function auditLog(
  supabase: ReturnType<typeof import("./supabase-server").createAdminSupabase>,
  userId: string,
  acao: string,
  tabela: string,
  registroId: string,
  dados?: Record<string, unknown>
) {
  await supabase.from("audit_log").insert({ user_id: userId, acao, tabela, registro_id: registroId, dados: dados || {} })
}
