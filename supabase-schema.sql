-- ============================================================
-- SCHEMA — Antecipação de Recebíveis Jurídicos
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Extensões
create extension if not exists "uuid-ossp";

-- Tabela de perfis de usuário (complementa auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  nome text not null,
  email text not null,
  criado_em timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Usuários veem todos os perfis" on public.profiles for select using (auth.uid() is not null);
create policy "Usuário edita próprio perfil" on public.profiles for update using (auth.uid() = id);

-- Trigger: cria profile ao criar usuário
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tabela de processos
create table public.processos (
  id uuid default uuid_generate_v4() primary key,
  numero text not null unique,
  pdf_url text,
  status text not null default 'pendente'
    check (status in ('pendente','processando','analisado','erro')),
  reclamante text,
  reclamada text,
  houve_sentenca boolean,
  houve_condenacao boolean,
  descricao_condenacao text,
  valor_condenacao numeric(15,2),
  houve_recurso boolean,
  recurso_julgado boolean,
  resultado_recurso text,
  valor_acordao numeric(15,2),
  erro_msg text,
  criado_por uuid references public.profiles(id),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);
alter table public.processos enable row level security;
create policy "Usuários autenticados acessam processos" on public.processos
  for all using (auth.uid() is not null);

-- Tabela de acompanhamentos
create table public.acompanhamentos (
  id uuid default uuid_generate_v4() primary key,
  processo_id uuid references public.processos(id) on delete cascade unique,
  stage text not null default 'novo'
    check (stage in ('novo','em_contato','proposta_enviada','negociando','contrato_gerado','fechado','rejeitado')),
  assignee_id uuid references public.profiles(id),
  valor_proposta numeric(15,2),
  observacoes text,
  criado_por uuid references public.profiles(id),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);
alter table public.acompanhamentos enable row level security;
create policy "Usuários autenticados acessam acompanhamentos" on public.acompanhamentos
  for all using (auth.uid() is not null);

-- Tabela de contatos
create table public.contatos (
  id uuid default uuid_generate_v4() primary key,
  acompanhamento_id uuid references public.acompanhamentos(id) on delete cascade,
  canal text not null check (canal in ('email','whatsapp','telefone')),
  resultado text not null,
  observacoes text,
  user_id uuid references public.profiles(id),
  criado_em timestamptz default now()
);
alter table public.contatos enable row level security;
create policy "Usuários autenticados acessam contatos" on public.contatos
  for all using (auth.uid() is not null);

-- Tabela de audit log
create table public.audit_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  acao text not null,
  tabela text not null,
  registro_id text,
  dados jsonb,
  criado_em timestamptz default now()
);
alter table public.audit_log enable row level security;
create policy "Usuários autenticados leem audit log" on public.audit_log
  for select using (auth.uid() is not null);
create policy "Sistema insere audit log" on public.audit_log
  for insert with check (auth.uid() is not null);

-- Tabela de configurações globais
create table public.configuracoes (
  chave text primary key,
  valor text not null,
  descricao text,
  atualizado_em timestamptz default now()
);
alter table public.configuracoes enable row level security;
create policy "Usuários autenticados leem configurações" on public.configuracoes
  for select using (auth.uid() is not null);
create policy "Usuários autenticados editam configurações" on public.configuracoes
  for all using (auth.uid() is not null);

-- Configuração inicial: percentual de oferta padrão
insert into public.configuracoes (chave, valor, descricao)
values ('percentual_oferta', '30', 'Percentual do valor da condenação usado como base da proposta (%)');

-- Função: atualiza atualizado_em automaticamente
create or replace function public.set_atualizado_em()
returns trigger as $$
begin new.atualizado_em = now(); return new; end;
$$ language plpgsql;
create trigger set_atualizado_em_processos
  before update on public.processos
  for each row execute function public.set_atualizado_em();
create trigger set_atualizado_em_acompanhamentos
  before update on public.acompanhamentos
  for each row execute function public.set_atualizado_em();

-- Storage bucket para PDFs
insert into storage.buckets (id, name, public) values ('processos-pdf', 'processos-pdf', false);
create policy "Usuários autenticados leem PDFs" on storage.objects
  for select using (auth.uid() is not null and bucket_id = 'processos-pdf');
create policy "Usuários autenticados fazem upload" on storage.objects
  for insert with check (auth.uid() is not null and bucket_id = 'processos-pdf');
