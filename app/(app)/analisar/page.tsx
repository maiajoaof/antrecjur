"use client"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase-client"
import { formatCurrency, formatDate, statusColor, statusLabel } from "@/lib/utils"
import type { Processo } from "@/types"

export default function AnalisarPage() {
  const supabase = createClient()
  const [processos, setProcessos] = useState<Processo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [filterStatus, setFilterStatus] = useState("todos")

  const load = useCallback(async () => {
    let q = supabase.from("processos").select("*").order("criado_em", { ascending: false })
    if (filterStatus !== "todos") q = q.eq("status", filterStatus)
    const { data } = await q
    setProcessos(data || [])
    setSelected(new Set())
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleAll() {
    if (selected.size === processos.length) setSelected(new Set())
    else setSelected(new Set(processos.map(p => p.id)))
  }

  async function handleDelete() {
    if (selected.size === 0) return
    if (!confirm(`Apagar ${selected.size} processo(s)? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    const { data: { user } } = await supabase.auth.getUser()
    for (const id of selected) {
      await supabase.from("processos").delete().eq("id", id)
      if (user) await supabase.from("audit_log").insert({ user_id: user.id, acao: "deletar", tabela: "processos", registro_id: id, dados: {} })
    }
    setMsg({ type: "ok", text: `${selected.size} processo(s) apagado(s).` })
    setDeleting(false)
    load()
  }

  async function handleAnalyze(processoId: string) {
    setAnalyzingId(processoId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      let token = session?.access_token || ""
      if (!token) {
        const { data: { session: refreshed } } = await supabase.auth.refreshSession()
        token = refreshed?.access_token || ""
      }
      if (!token) { alert("Sessão expirada. Faça login novamente."); window.location.href = "/auth/login"; return }

      const resp = await fetch("/api/analisar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ processoId }),
      })
      if (!resp.ok) { const d = await resp.json(); throw new Error(d.error || "Erro na análise") }
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro")
    } finally { setAnalyzingId(null) }
  }

  async function handleSendToAcompanhar() {
    const eligibleSelected = [...selected].filter(id => processos.find(p => p.id === id)?.status === "analisado")
    if (eligibleSelected.length === 0) return
    setSending(true); setMsg(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Não autenticado")
      const { data: config } = await supabase.from("configuracoes").select("valor").eq("chave", "percentual_oferta").single()
      const pct = parseFloat(config?.valor || "30") / 100
      for (const id of eligibleSelected) {
        const p = processos.find(x => x.id === id)
        if (!p) continue
        const valorProposta = p.valor_condenacao ? p.valor_condenacao * pct : null
        const { data: existing } = await supabase.from("acompanhamentos").select("id").eq("processo_id", id).single()
        if (!existing) {
          await supabase.from("acompanhamentos").insert({ processo_id: id, stage: "novo", valor_proposta: valorProposta, criado_por: user.id })
          await supabase.from("audit_log").insert({ user_id: user.id, acao: "enviar_acompanhar", tabela: "acompanhamentos", registro_id: id, dados: { valor_proposta: valorProposta } })
        }
      }
      setMsg({ type: "ok", text: `${eligibleSelected.length} processo(s) enviado(s) para Acompanhar!` })
      setSelected(new Set())
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Erro" })
    } finally { setSending(false) }
  }

  const anySelected = selected.size > 0
  const eligibleForAcompanhar = [...selected].filter(id => processos.find(p => p.id === id)?.status === "analisado").length

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Analisar processos</h1>
            <p className="text-sm text-slate-500 mt-1">Analise os PDFs e selecione processos para acompanhamento.</p>
          </div>
          <div className="flex gap-2">
            {anySelected && (
              <>
                <button onClick={handleDelete} disabled={deleting} className="btn-danger">
                  {deleting ? "Apagando..." : `🗑 Apagar ${selected.size}`}
                </button>
                {eligibleForAcompanhar > 0 && (
                  <button onClick={handleSendToAcompanhar} className="btn-primary" disabled={sending}>
                    {sending ? "Enviando..." : `🤝 Enviar ${eligibleForAcompanhar} para Acompanhar`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {msg && (
          <div className={`mb-4 text-sm px-4 py-3 rounded-lg ${msg.type === "ok" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
            {msg.text}
          </div>
        )}

        <div className="flex gap-2 mb-4 items-center flex-wrap">
          {["todos", "pendente", "processando", "analisado", "erro"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === s ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
              {s === "todos" ? "Todos" : statusLabel(s)}
            </button>
          ))}
          {anySelected && <span className="text-xs text-slate-500 ml-2">{selected.size} selecionado(s)</span>}
        </div>

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="table-th w-10">
                  <input type="checkbox" checked={selected.size === processos.length && processos.length > 0} onChange={toggleAll} className="rounded" />
                </th>
                <th className="table-th">Número do processo</th>
                <th className="table-th">Status</th>
                <th className="table-th">Reclamante</th>
                <th className="table-th">Reclamada</th>
                <th className="table-th">Valor condenação</th>
                <th className="table-th">Recurso</th>
                <th className="table-th">Cadastrado em</th>
                <th className="table-th">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {processos.length === 0 ? (
                <tr><td colSpan={10} className="table-td text-center text-slate-400 py-8">Nenhum processo encontrado.</td></tr>
              ) : processos.map((p) => (
                <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${selected.has(p.id) ? "bg-red-50" : ""}`}>
                  <td className="table-td">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" />
                  </td>
                  <td className="table-td font-mono text-xs">{p.numero}</td>
                  <td className="table-td"><span className={`badge ${statusColor(p.status)}`}>{statusLabel(p.status)}</span></td>
                  <td className="table-td text-xs">{p.reclamante || <span className="text-slate-400">—</span>}</td>
                  <td className="table-td text-xs">{p.reclamada || <span className="text-slate-400">—</span>}</td>
                  <td className="table-td text-xs font-mono">{formatCurrency(p.valor_condenacao)}</td>
                  <td className="table-td text-xs">
                    {p.houve_recurso === null ? "—" : p.houve_recurso ? <span className="text-amber-600">Sim</span> : <span className="text-green-600">Não</span>}
                  </td>
                  <td className="table-td text-xs">
                    {p.advogados_reclamada && p.advogados_reclamada.length > 0
                      ? <div className="space-y-1">
                          {p.advogados_reclamada.map((a, i) => (
                            <div key={i}>
                              <span className="font-medium text-slate-700">{a.nome}</span>
                              {a.oab && <span className="text-slate-400 ml-1">({a.oab})</span>}
                            </div>
                          ))}
                        </div>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="table-td text-xs text-slate-400">{formatDate(p.criado_em)}</td>
                  <td className="table-td">
                    <div className="flex gap-2">
                      {p.pdf_url && (p.status === "pendente" || p.status === "erro") && (
                        <button onClick={() => handleAnalyze(p.id)} disabled={analyzingId === p.id}
                          className={`text-xs px-2 py-1 rounded ${p.status === "erro" ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-blue-50 text-blue-700 hover:bg-blue-100"} disabled:opacity-50`}>
                          {analyzingId === p.id ? "⏳" : p.status === "erro" ? "🔄 Tentar novamente" : "🤖 Analisar"}
                        </button>
                      )}
                      {p.pdf_url && (
                        <a href={p.pdf_url} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-slate-700">📄</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
