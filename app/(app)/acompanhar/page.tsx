"use client"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase-client"
import { formatCurrency, formatDate, stageColor, stageLabel } from "@/lib/utils"
import type { Acompanhamento, CanalContato } from "@/types"

const STAGES = ["novo", "em_contato", "proposta_enviada", "negociando", "contrato_gerado", "fechado", "rejeitado"]
const CANAIS: { value: CanalContato; label: string; icon: string }[] = [
  { value: "email", label: "Email", icon: "✉️" },
  { value: "whatsapp", label: "WhatsApp", icon: "💬" },
  { value: "telefone", label: "Telefone", icon: "📞" },
]

export default function AcompanharPage() {
  const supabase = createClient()
  const [items, setItems] = useState<Acompanhamento[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [filterStage, setFilterStage] = useState("todos")
  const [filterMeu, setFilterMeu] = useState(false)
  const [selected, setSelected] = useState<Acompanhamento | null>(null)
  const [contatos, setContatos] = useState<{ canal: string; resultado: string; observacoes: string; criado_em: string; user?: { nome: string } }[]>([])
  const [novoContato, setNovoContato] = useState<{ canal: CanalContato; resultado: string; observacoes: string }>({ canal: "email", resultado: "", observacoes: "" })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id || null))
  }, [])

  const load = useCallback(async () => {
    let q = supabase.from("acompanhamentos")
      .select("*, processo:processos(*), assignee:profiles!acompanhamentos_assignee_id_fkey(id,email,nome)")
      .order("atualizado_em", { ascending: false })
    if (filterStage !== "todos") q = q.eq("stage", filterStage)
    if (filterMeu && userId) q = q.eq("assignee_id", userId)
    const { data } = await q
    setItems((data || []) as unknown as Acompanhamento[])
  }, [filterStage, filterMeu, userId])

  useEffect(() => { if (userId !== null) load() }, [load, userId])

  async function loadContatos(acompId: string) {
    const { data } = await supabase.from("contatos")
      .select("*, user:profiles(nome)")
      .eq("acompanhamento_id", acompId)
      .order("criado_em", { ascending: false })
    setContatos((data || []) as typeof contatos)
  }

  function openDetail(item: Acompanhamento) {
    setSelected(item)
    loadContatos(item.id)
    setMsg(null)
  }

  async function handleAssign(item: Acompanhamento) {
    if (!userId) return
    const newId = item.assignee_id === userId ? null : userId
    await supabase.from("acompanhamentos").update({ assignee_id: newId }).eq("id", item.id)
    await supabase.from("audit_log").insert({ user_id: userId, acao: newId ? "atribuir" : "desatribuir", tabela: "acompanhamentos", registro_id: item.id, dados: {} })
    load()
    if (selected?.id === item.id) setSelected(prev => prev ? { ...prev, assignee_id: newId } : prev)
  }

  async function handleStageChange(item: Acompanhamento, stage: string) {
    if (!userId) return
    await supabase.from("acompanhamentos").update({ stage }).eq("id", item.id)
    await supabase.from("audit_log").insert({ user_id: userId, acao: "mudar_stage", tabela: "acompanhamentos", registro_id: item.id, dados: { stage } })
    load()
    if (selected?.id === item.id) setSelected(prev => prev ? { ...prev, stage: stage as typeof prev.stage } : prev)
  }

  async function handleAddContato() {
    if (!selected || !novoContato.resultado.trim() || !userId) return
    setSaving(true)
    await supabase.from("contatos").insert({
      acompanhamento_id: selected.id, canal: novoContato.canal,
      resultado: novoContato.resultado, observacoes: novoContato.observacoes || null, user_id: userId,
    })
    await supabase.from("acompanhamentos").update({ stage: "em_contato" }).eq("id", selected.id).eq("stage", "novo")
    await supabase.from("audit_log").insert({ user_id: userId, acao: "registrar_contato", tabela: "contatos", registro_id: selected.id, dados: novoContato })
    setNovoContato({ canal: "email", resultado: "", observacoes: "" })
    setMsg("Contato registrado!")
    loadContatos(selected.id)
    load()
    setSaving(false)
  }

  async function handleUpdateProposta(novoValor: number) {
    if (!selected || !userId) return
    await supabase.from("acompanhamentos").update({ valor_proposta: novoValor, stage: "proposta_enviada" }).eq("id", selected.id)
    await supabase.from("audit_log").insert({ user_id: userId, acao: "atualizar_proposta", tabela: "acompanhamentos", registro_id: selected.id, dados: { valor_proposta: novoValor } })
    setSelected(prev => prev ? { ...prev, valor_proposta: novoValor, stage: "proposta_enviada" } : prev)
    setMsg("Proposta atualizada!")
    load()
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Acompanhar processos</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie o contato com advogados e as propostas de compra.</p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <button onClick={() => setFilterMeu(!filterMeu)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterMeu ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>
            {filterMeu ? "👤 Meus processos" : "👥 Todos os processos"}
          </button>
          <div className="w-px h-5 bg-slate-200" />
          {["todos", ...STAGES].map(s => (
            <button key={s} onClick={() => setFilterStage(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStage === s ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
              {s === "todos" ? "Todos os stages" : stageLabel(s)}
            </button>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Lista */}
          <div className={`${selected ? "w-1/2" : "w-full"} card overflow-hidden transition-all`}>
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="table-th">Processo</th>
                  <th className="table-th">Stage</th>
                  <th className="table-th">Proposta</th>
                  <th className="table-th">Responsável</th>
                  <th className="table-th">Atualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.length === 0 ? (
                  <tr><td colSpan={5} className="table-td text-center text-slate-400 py-8">Nenhum processo em acompanhamento.</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id} onClick={() => openDetail(item)}
                    className={`cursor-pointer hover:bg-slate-50 transition-colors ${selected?.id === item.id ? "bg-blue-50" : ""}`}>
                    <td className="table-td">
                      <p className="font-mono text-xs text-slate-600">{(item as unknown as Record<string, Record<string, string>>).processo?.numero}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{(item as unknown as Record<string, Record<string, string>>).processo?.reclamante || "—"}</p>
                    </td>
                    <td className="table-td"><span className={`badge ${stageColor(item.stage)}`}>{stageLabel(item.stage)}</span></td>
                    <td className="table-td font-mono text-xs">{formatCurrency(item.valor_proposta)}</td>
                    <td className="table-td text-xs">
                      {(item as unknown as Record<string, Record<string, string>>).assignee?.nome || <span className="text-slate-400">Sem responsável</span>}
                    </td>
                    <td className="table-td text-xs text-slate-400">{formatDate(item.atualizado_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Painel de detalhe */}
          {selected && (
            <div className="w-1/2 space-y-4">
              <div className="card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-mono text-sm text-slate-500">{(selected as unknown as Record<string, Record<string, string>>).processo?.numero}</p>
                    <h2 className="font-semibold text-slate-900 mt-0.5">{(selected as unknown as Record<string, Record<string, string>>).processo?.reclamante}</h2>
                    <p className="text-sm text-slate-500">vs. {(selected as unknown as Record<string, Record<string, string>>).processo?.reclamada}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Valor da condenação</p>
                    <p className="font-mono text-sm font-semibold">{formatCurrency((selected as unknown as Record<string, Record<string, number>>).processo?.valor_condenacao)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Proposta atual</p>
                    <p className="font-mono text-sm font-semibold text-green-700">{formatCurrency(selected.valor_proposta)}</p>
                  </div>
                </div>

                {/* Stage */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-slate-500 mb-2">Stage</p>
                  <select className="input text-sm" value={selected.stage} onChange={e => handleStageChange(selected, e.target.value)}>
                    {STAGES.map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}
                  </select>
                </div>

                {/* Proposta */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-slate-500 mb-2">Atualizar proposta (R$)</p>
                  <div className="flex gap-2">
                    <input type="number" step="0.01" className="input text-sm font-mono" defaultValue={selected.valor_proposta || ""} id="proposta-input" />
                    <button className="btn-secondary text-xs" onClick={() => {
                      const val = parseFloat((document.getElementById("proposta-input") as HTMLInputElement).value)
                      if (!isNaN(val)) handleUpdateProposta(val)
                    }}>Salvar</button>
                  </div>
                </div>

                {/* Atribuição */}
                <button onClick={() => handleAssign(selected)} className="btn-secondary w-full justify-center text-xs">
                  {selected.assignee_id === userId ? "✓ Meu processo — clique para desatribuir" : "👤 Atribuir a mim"}
                </button>

                {msg && <p className="text-xs text-green-600 mt-2">{msg}</p>}
              </div>

              {/* Registrar contato */}
              <div className="card p-5">
                <h3 className="font-semibold text-slate-900 mb-3 text-sm">Registrar contato</h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {CANAIS.map(c => (
                      <button key={c.value} onClick={() => setNovoContato(p => ({ ...p, canal: c.value }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${novoContato.canal === c.value ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                        {c.icon} {c.label}
                      </button>
                    ))}
                  </div>
                  <input className="input text-sm" placeholder="Resultado (ex: Sem resposta, Interessado, ...)" value={novoContato.resultado} onChange={e => setNovoContato(p => ({ ...p, resultado: e.target.value }))} />
                  <textarea className="input text-sm resize-none" rows={2} placeholder="Observações (opcional)" value={novoContato.observacoes} onChange={e => setNovoContato(p => ({ ...p, observacoes: e.target.value }))} />
                  <button onClick={handleAddContato} disabled={saving || !novoContato.resultado.trim()} className="btn-primary w-full justify-center text-xs">
                    {saving ? "Salvando..." : "Registrar contato"}
                  </button>
                </div>
              </div>

              {/* Histórico */}
              <div className="card p-5">
                <h3 className="font-semibold text-slate-900 mb-3 text-sm">Histórico de contatos</h3>
                {contatos.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhum contato registrado ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {contatos.map((c, i) => (
                      <div key={i} className="flex gap-3 text-xs">
                        <span className="text-base">{CANAIS.find(x => x.value === c.canal)?.icon || "📞"}</span>
                        <div>
                          <p className="font-medium text-slate-700">{c.resultado}</p>
                          {c.observacoes && <p className="text-slate-500 mt-0.5">{c.observacoes}</p>}
                          <p className="text-slate-400 mt-0.5">{formatDate(c.criado_em)} · {c.user?.nome}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
