"use client"
import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase-client"
import { formatDate, statusColor, statusLabel } from "@/lib/utils"
import type { Processo } from "@/types"

export default function EncontrarPage() {
  const supabase = createClient()
  const [numero, setNumero] = useState("")
  const [pdf, setPdf] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [processos, setProcessos] = useState<Processo[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadProcessos() {
    setLoadingList(true)
    const { data } = await supabase.from("processos").select("*").order("criado_em", { ascending: false }).limit(50)
    setProcessos(data || [])
    setSelected(new Set())
    setLoadingList(false)
  }

  useEffect(() => { loadProcessos() }, [])

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
    loadProcessos()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!numero.trim()) return
    setLoading(true); setMsg(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Não autenticado")
      let pdfUrl: string | null = null
      if (pdf) {
        const filename = `${Date.now()}_${pdf.name.replace(/\s/g, "_")}`
        const { error: upErr } = await supabase.storage.from("processos-pdf").upload(filename, pdf)
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from("processos-pdf").getPublicUrl(filename)
        pdfUrl = urlData.publicUrl
      }
      const { error } = await supabase.from("processos").insert({ numero: numero.trim(), pdf_url: pdfUrl, status: "pendente", criado_por: user.id })
      if (error) { if (error.code === "23505") throw new Error("Número de processo já cadastrado"); throw error }
      await supabase.from("audit_log").insert({ user_id: user.id, acao: "criar", tabela: "processos", registro_id: numero.trim(), dados: { numero, pdf_url: pdfUrl } })
      setMsg({ type: "ok", text: `Processo ${numero} cadastrado com sucesso!` })
      setNumero(""); setPdf(null)
      if (fileRef.current) fileRef.current.value = ""
      loadProcessos()
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Erro ao cadastrar" })
    } finally { setLoading(false) }
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Encontrar processos</h1>
          <p className="text-sm text-slate-500 mt-1">Cadastre manualmente um processo informando o número e o PDF.</p>
        </div>

        <div className="card p-6 mb-8">
          <h2 className="font-semibold text-slate-900 mb-4">Novo processo</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Número do processo *</label>
                <input type="text" className="input font-mono" value={numero} onChange={e => setNumero(e.target.value)} placeholder="0000000-00.0000.0.00.0000" required />
              </div>
              <div>
                <label className="label">PDF do processo</label>
                <input ref={fileRef} type="file" accept=".pdf" className="input py-1.5 cursor-pointer" onChange={e => setPdf(e.target.files?.[0] || null)} />
              </div>
            </div>
            {msg && (
              <div className={`text-sm px-4 py-3 rounded-lg ${msg.type === "ok" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                {msg.text}
              </div>
            )}
            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Cadastrando..." : "➕ Cadastrar processo"}</button>
            </div>
          </form>
        </div>

        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-slate-900">Processos cadastrados</h2>
              {selected.size > 0 && <span className="text-xs text-slate-500">{selected.size} selecionado(s)</span>}
            </div>
            <div className="flex gap-2">
              {selected.size > 0 && (
                <button onClick={handleDelete} disabled={deleting} className="btn-danger text-xs">
                  {deleting ? "Apagando..." : `🗑 Apagar ${selected.size}`}
                </button>
              )}
              <button onClick={loadProcessos} className="btn-secondary text-xs">↻ Atualizar</button>
            </div>
          </div>
          {loadingList ? (
            <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>
          ) : processos.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Nenhum processo cadastrado ainda.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="table-th w-10">
                    <input type="checkbox" checked={selected.size === processos.length && processos.length > 0} onChange={toggleAll} className="rounded" />
                  </th>
                  <th className="table-th">Número do processo</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">PDF</th>
                  <th className="table-th">Cadastrado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {processos.map((p) => (
                  <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${selected.has(p.id) ? "bg-red-50" : ""}`}>
                    <td className="table-td">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" />
                    </td>
                    <td className="table-td font-mono text-xs">{p.numero}</td>
                    <td className="table-td"><span className={`badge ${statusColor(p.status)}`}>{statusLabel(p.status)}</span></td>
                    <td className="table-td">
                      {p.pdf_url ? <a href={p.pdf_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">📄 Ver PDF</a> : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="table-td text-xs text-slate-400">{formatDate(p.criado_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
