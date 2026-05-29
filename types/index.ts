export type ProcessoStatus =
  | "pendente"
  | "processando"
  | "analisado"
  | "erro"

export type AcompanhamentoStage =
  | "novo"
  | "em_contato"
  | "proposta_enviada"
  | "negociando"
  | "contrato_gerado"
  | "fechado"
  | "rejeitado"

export type CanalContato = "email" | "whatsapp" | "telefone"

export interface Advogado {
  nome: string
  oab: string
}

export interface Processo {
  id: string
  numero: string
  pdf_url: string | null
  status: ProcessoStatus
  reclamante: string | null
  reclamada: string | null
  advogados_reclamada: Advogado[] | null
  advogados_reclamante: Advogado[] | null
  houve_sentenca: boolean | null
  houve_condenacao: boolean | null
  descricao_condenacao: string | null
  valor_condenacao: number | null
  houve_recurso: boolean | null
  recurso_julgado: boolean | null
  resultado_recurso: string | null
  valor_acordao: number | null
  erro_msg: string | null
  criado_por: string
  criado_em: string
  atualizado_em: string
}

export interface Acompanhamento {
  id: string
  processo_id: string
  stage: AcompanhamentoStage
  assignee_id: string | null
  valor_proposta: number | null
  observacoes: string | null
  criado_por: string
  criado_em: string
  atualizado_em: string
  processo?: Processo
  assignee?: { id: string; email: string; nome: string }
}

export interface Contato {
  id: string
  acompanhamento_id: string
  canal: CanalContato
  resultado: string
  observacoes: string | null
  user_id: string
  criado_em: string
  user?: { email: string; nome: string }
}

export interface AuditLog {
  id: string
  user_id: string
  acao: string
  tabela: string
  registro_id: string
  dados: Record<string, unknown>
  criado_em: string
  user?: { email: string; nome: string }
}

export interface User {
  id: string
  email: string
  nome: string
  criado_em: string
}
