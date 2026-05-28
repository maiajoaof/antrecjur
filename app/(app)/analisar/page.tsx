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
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [filterStatus, setFilterStatus] = useState("todos")

  const load = useCallback(async () => {
    let q = supabase.from("processos").select("*").order("criado_em", { ascending: false })
    if (filterStatus !== "todos") q = q.eq("status", filterStatus)
    const { data } = await q
    setProcessos(data || [])
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    const eligible = processos.filter(p => p.status === "analisado").map(p => p.id)
    if (eligible.every(id => selected.has(id))) {
      setSelected(new Set())
    } else {
      setSelected(new Set(eligible))
    }
  }

  async function handleAnalyze(processoId: string) {
    setAnalyzingId(processoId)
    try {
      const resp = await fetch("/api/analisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processoId }),
      })
      if (!resp.ok) {
        const d = await resp.json()
        throw new Error(d.error || "Erro na análise")
      }
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro")
    } finally {
      setAnalyzingId(null)
    }
  }

  async function handleSendToAcompanhar() {
    if (selected.size === 0) return
    setSending(true); setMsg(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Não autenticado")
      const { data: config } = await supabase.from("configuracoes").select("valor").eq("chave", "percentual_oferta").single()
      const pct = parseFloat(config?.valor || "30") / 100

      for (const id of selected) {
        const p = processos.find(x => x.id === id)
        if (!p) continue
        const valorProposta = p.valor_condenacao ? p.valor_condenacao * pct : null
        const { data: existing } = await supabase.from("acompanhamentos").select("id").eq("processo_id", id).single()
        if (!existing) {
          await supabase.from("acompanhamentos").insert({ processo_id: id, stage: "novo", valor_proposta: valorProposta, criado_por: user.id })
          await supabase.from("audit_log").insert({ user_id: user.id, acao: "enviar_acompanhar", tabela: "acompanhamentos", registro_id: id, dados: { valor_proposta: valorProposta } })
        }
      }
      setMsg({ type: "ok", text: `${selected.size} processo(s) enviado(s) para Acompanhar!` })
      setSelected(new Set())
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Erro" })
    } finally {
      setSending(false)
    }
  }

  const eligible = processos.filter(p => p.status === "analisado")
  const allEligibleSelected = eligible.length > 0 && eligible.every(p => selected.has(p.id))

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Analisar processos</h1>
            <p className="text-sm text-slate-500 mt-1">Analise os PDFs e selecione processos para acompanhamento.</p>
          </div>
          {selected.size > 0 && (
            <button onClick={handleSendToAcompanhar} className="btn-primary" disabled={sending}>
              {sending ? "Enviando..." : `🤝 Enviar ${selected.size} para Acompanhar`}
            </button>
          )}
        </div>

        {msg && (
          <div className={`mb-4 text-sm px-4 py-3 rounded-lg ${msg.type === "ok" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
            {msg.text}
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-2 mb-4">
          {["todos", "pendente", "processando", "analisado", "erro"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === s ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
              {s === "todos" ? "Todos" : statusLabel(s)}
            </button>
          ))}
        </div>

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="table-th w-10">
                  <input type="checkbox" checked={allEligibleSelected} onChange={toggleAll} className="rounded" />
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
                <tr><td colSpan={9} className="table-td text-center text-slate-400 py-8">Nenhum processo encontrado.</td></tr>
              ) : processos.map((p) => (
                <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${selected.has(p.id) ? "bg-blue-50" : ""}`}>
                  <td className="table-td">
                    {p.status === "analisado" && (
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" />
                    )}
                  </td>
                  <td className="table-td font-mono text-xs">{p.numero}</td>
                  <td className="table-td"><span className={`badge ${statusColor(p.status)}`}>{statusLabel(p.status)}</span></td>
                  <td className="table-td text-xs">{p.reclamante || <span className="text-slate-400">—</span>}</td>
                  <td className="table-td text-xs">{p.reclamada || <span className="text-slate-400">—</span>}</td>
                  <td className="table-td text-xs font-mono">{formatCurrency(p.valor_condenacao)}</td>
                  <td className="table-td text-xs">
                    {p.houve_recurso === null ? "—" : p.houve_recurso ? <span className="text-amber-600">Sim</span> : <span className="text-green-600">Não</span>}
                  </td>
                  <td className="table-td text-xs text-slate-400">{formatDate(p.criado_em)}</td>
                  <td className="table-td">
                    <div className="flex gap-2">
                      {p.pdf_url && p.status === "pendente" && (
                        <button onClick={() => handleAnalyze(p.id)} disabled={analyzingId === p.id}
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 disabled:opacity-50">
                          {analyzingId === p.id ? "⏳" : "🤖 Analisar"}
                        </button>
                      )}
                      {p.status === "erro" && (
                        <button onClick={() => handleAnalyze(p.id)} disabled={analyzingId === p.id}
                          className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100">
                          🔄 Tentar novamente
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
