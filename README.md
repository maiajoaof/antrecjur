# Recebíveis Jurídicos — Protótipo

Sistema de antecipação de recebíveis jurídicos para demonstração a investidores.

## Stack
- **Next.js 14** — frontend + API routes
- **Supabase** — auth, banco PostgreSQL, storage de PDFs
- **Anthropic Claude** — extração de dados dos processos
- **Tailwind CSS** — interface

## Setup local

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar Supabase
1. Crie um projeto em [supabase.com](https://supabase.com)
2. No SQL Editor, execute o conteúdo de `supabase-schema.sql`
3. Em Storage, confirme que o bucket `processos-pdf` foi criado

### 3. Configurar variáveis de ambiente
```bash
cp .env.example .env.local
```
Preencha com suas chaves:
- `NEXT_PUBLIC_SUPABASE_URL` — em Project Settings > API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — em Project Settings > API
- `SUPABASE_SERVICE_ROLE_KEY` — em Project Settings > API (service_role)
- `ANTHROPIC_API_KEY` — em console.anthropic.com

### 4. Criar primeiro usuário
No Supabase Authentication > Users, clique em "Add user" e crie o primeiro usuário manualmente. Os demais podem ser criados pela tela de Admin do sistema.

### 5. Rodar
```bash
npm run dev
```
Acesse: http://localhost:3000

## Deploy (Vercel)
1. Suba o código no GitHub
2. Conecte o repositório na Vercel
3. Adicione as variáveis de ambiente no painel da Vercel
4. Deploy automático

## Módulos

### 🔎 Encontrar
Cadastro manual de processos com número e PDF. Lista dos processos cadastrados com status.

### 📋 Analisar
Lista de todos os processos. Botão "Analisar" extrai dados do PDF via IA. Seletor múltiplo envia processos para Acompanhar.

### 🤝 Acompanhar
Lista com filtros por stage e "Meus processos". Painel lateral com: gestão de stage, proposta calculada automaticamente, registro de contatos (email/WhatsApp/telefone), histórico de contatos.

### 📊 Dashboard
Métricas: total de processos, em acompanhamento, valor em negociação, taxa de conversão, pipeline por stage.

### ⚙️ Admin
Configuração do percentual de oferta, gestão de usuários, log de auditoria completo.
