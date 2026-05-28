import { redirect } from "next/navigation"
import { createServerSupabase } from "@/lib/supabase-server"
import { formatCurrency } from "@/lib/utils"

export default async function DashboardPage() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  const { data: profile } = await supabase.from("profiles").select("nome,email").eq("id", user.id).single()

  const [
    { count: totalProcessos },
    { count: analisados },
    { count: emAcompanhamento },
    { count: fechados },
    { data: acomps },
    { data: processosMes },
  ] = await Promise.all([
    supabase.from("processos").select("*", { count: "exact", head: true }),
    supabase.from("processos").select("*", { count: "exact", head: true }).eq("status", "analisado"),
    supabase.from("acompanhamentos").select("*", { count: "exact", head: true }).not("stage", "in", '("fechado","rejeitado")'),
    supabase.from("acompanhamentos").select("*", { count: "exact", head: true }).eq("stage", "fechado"),
    supabase.from("acompanhamentos").select("valor_proposta").not("stage", "in", '("fechado","rejeitado")'),
    supabase.from("processos").select("criado_em").gte("criado_em", new Date(Date.now() - 30 * 86400000).toISOString()),
  ])

  const totalNegociacao = (acomps || []).reduce((s, a) => s + (a.valor_proposta || 0), 0)
  const taxaConversao = analisados ? Math.round(((fechados || 0) / (analisados || 1)) * 100) : 0

  const metrics = [
    { label: "Total de processos", value: totalProcessos?.toString() || "0", sub: `${processosMes?.length || 0} nos últimos 30 dias`, icon: "📁" },
    { label: "Em acompanhamento", value: emAcompanhamento?.toString() || "0", sub: "processos ativos", icon: "🤝" },
    { label: "Valor em negociação", value: formatCurrency(totalNegociacao), sub: "propostas ativas", icon: "💰" },
    { label: "Taxa de conversão", value: `${taxaConversao}%`, sub: `${fechados || 0} contratos fechados`, icon: "✅" },
  ]

  const statusItems = [
    { label: "Pendentes de análise", status: "pendente", color: "bg-yellow-400" },
    { label: "Analisados", status: "analisado", color: "bg-green-400" },
    { label: "Com erro", status: "erro", color: "bg-red-400" },
  ]

  const statusCounts = await Promise.all(
    statusItems.map(({ status }) =>
      supabase.from("processos").select("*", { count: "exact", head: true }).eq("status", status).then(({ count }) => count || 0)
    )
  )

  const stageItems = [
    { label: "Novo", stage: "novo" },
    { label: "Em contato", stage: "em_contato" },
    { label: "Proposta enviada", stage: "proposta_enviada" },
    { label: "Negociando", stage: "negociando" },
    { label: "Contrato gerado", stage: "contrato_gerado" },
  ]

  const stageCounts = await Promise.all(
    stageItems.map(({ stage }) =>
      supabase.from("acompanhamentos").select("*", { count: "exact", head: true }).eq("stage", stage).then(({ count }) => count || 0)
    )
  )

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="text-sm text-slate-500 mb-1">Bem-vindo,</p>
          <h1 className="text-2xl font-semibold text-slate-900">{profile?.nome}</h1>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metrics.map((m) => (
            <div key={m.label} className="card p-5">
              <div className="text-2xl mb-2">{m.icon}</div>
              <p className="text-2xl font-semibold text-slate-900">{m.value}</p>
              <p className="text-xs text-slate-500 mt-1">{m.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Status dos processos</h2>
            <div className="space-y-3">
              {statusItems.map(({ label, color }, i) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-sm text-slate-600">{label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{statusCounts[i]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Pipeline de acompanhamento</h2>
            <div className="space-y-3">
              {stageItems.map(({ label }, i) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{label}</span>
                  <span className="text-sm font-semibold text-slate-900">{stageCounts[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
