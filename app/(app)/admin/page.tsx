"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase-client"
import { formatDate } from "@/lib/utils"

export default function AdminPage() {
  const supabase = createClient()
  const [pct, setPct] = useState("30")
  const [saving, setSaving] = useState(false)
  const [pctMsg, setPctMsg] = useState("")
  const [users, setUsers] = useState<{ id: string; nome: string; email: string; criado_em: string }[]>([])
  const [logs, setLogs] = useState<{ id: string; acao: string; tabela: string; registro_id: string; criado_em: string; user?: { nome: string } }[]>([])
  const [newUser, setNewUser] = useState({ email: "", nome: "", password: "" })
  const [creatingUser, setCreatingUser] = useState(false)
  const [userMsg, setUserMsg] = useState("")

  useEffect(() => {
    supabase.from("configuracoes").select("valor").eq("chave", "percentual_oferta").single()
      .then(({ data }) => { if (data) setPct(data.valor) })
    supabase.from("profiles").select("*").order("criado_em", { ascending: false })
      .then(({ data }) => setUsers(data || []))
    supabase.from("audit_log").select("*, user:profiles(nome)").order("criado_em", { ascending: false }).limit(50)
      .then(({ data }) => setLogs((data || []) as typeof logs))
  }, [])

  async function savePct() {
    setSaving(true)
    await supabase.from("configuracoes").update({ valor: pct }).eq("chave", "percentual_oferta")
    setPctMsg("Salvo!"); setSaving(false)
    setTimeout(() => setPctMsg(""), 2000)
  }

  async function createUser() {
    if (!newUser.email || !newUser.nome || !newUser.password) return
    setCreatingUser(true); setUserMsg("")
    const resp = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    })
    const data = await resp.json()
    if (!resp.ok) { setUserMsg("Erro: " + data.error); setCreatingUser(false); return }
    setUserMsg("Usuário criado!")
    setNewUser({ email: "", nome: "", password: "" })
    const { data: us } = await supabase.from("profiles").select("*").order("criado_em", { ascending: false })
    setUsers(us || [])
    setCreatingUser(false)
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Administração</h1>
          <p className="text-sm text-slate-500 mt-1">Configurações globais do sistema.</p>
        </div>

        {/* Configuração de percentual */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-1">Parâmetro de proposta</h2>
          <p className="text-sm text-slate-500 mb-4">Percentual do valor da condenação usado como base para calcular a proposta de compra.</p>
          <div className="flex items-center gap-3">
            <div className="relative w-40">
              <input type="number" min="1" max="100" step="0.5" className="input pr-8 font-mono" value={pct} onChange={e => setPct(e.target.value)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
            <button onClick={savePct} className="btn-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
            {pctMsg && <span className="text-sm text-green-600">{pctMsg}</span>}
          </div>
          <p className="text-xs text-slate-400 mt-3">Ex: com 30%, uma condenação de R$ 50.000 gera proposta de R$ 15.000 automaticamente.</p>
        </div>

        {/* Gestão de usuários */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Usuários do sistema</h2>
          <div className="space-y-3 mb-6">
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Nome</label><input className="input" value={newUser.nome} onChange={e => setNewUser(p => ({ ...p, nome: e.target.value }))} placeholder="Nome completo" /></div>
              <div><label className="label">Email</label><input type="email" className="input" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} placeholder="email@empresa.com" /></div>
              <div><label className="label">Senha inicial</label><input type="password" className="input" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" /></div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={createUser} className="btn-primary" disabled={creatingUser}>{creatingUser ? "Criando..." : "➕ Criar usuário"}</button>
              {userMsg && <span className={`text-sm ${userMsg.startsWith("Erro") ? "text-red-600" : "text-green-600"}`}>{userMsg}</span>}
            </div>
          </div>

          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100 rounded-lg">
              <tr>
                <th className="table-th">Nome</th>
                <th className="table-th">Email</th>
                <th className="table-th">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="table-td font-medium">{u.nome}</td>
                  <td className="table-td text-slate-500">{u.email}</td>
                  <td className="table-td text-xs text-slate-400">{formatDate(u.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Audit log */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Log de auditoria</h2>
          <div className="overflow-y-auto max-h-80">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                <tr>
                  <th className="table-th">Usuário</th>
                  <th className="table-th">Ação</th>
                  <th className="table-th">Tabela</th>
                  <th className="table-th">Registro</th>
                  <th className="table-th">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="table-td text-xs">{l.user?.nome || "—"}</td>
                    <td className="table-td"><span className="badge bg-slate-100 text-slate-600">{l.acao}</span></td>
                    <td className="table-td text-xs text-slate-500">{l.tabela}</td>
                    <td className="table-td font-mono text-xs text-slate-400 max-w-xs truncate">{l.registro_id}</td>
                    <td className="table-td text-xs text-slate-400">{formatDate(l.criado_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
