-- =====================================================
-- SISTEMA DE VOTACAO POR CATEGORIA - SCHEMA SUPABASE
-- Rode este script inteiro no SQL Editor do Supabase
-- =====================================================

-- extensao para gerar UUID
create extension if not exists "pgcrypto";

-- =====================================================
-- TABELA: admins
-- =====================================================
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

-- =====================================================
-- TABELA: site_settings (config global do site)
-- linha unica controlada por id fixo
-- =====================================================
create table if not exists site_settings (
  id int primary key default 1,
  site_title text default 'Votação Oficial',
  site_subtitle text default 'Escolha suas favoritas em cada categoria',
  background_image_url text,
  theme text default 'premiere',
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

insert into site_settings (id) values (1)
on conflict (id) do nothing;

-- migração para bancos que rodaram o schema antes da coluna "theme" existir
alter table site_settings add column if not exists theme text default 'premiere';

-- =====================================================
-- TABELA: categories
-- =====================================================
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  status text not null default 'agendada' check (status in ('agendada','aberta','encerrada')),
  starts_at timestamptz,
  ends_at timestamptz,
  display_order int default 0,
  created_at timestamptz default now()
);

-- =====================================================
-- TABELA: options (opcoes dentro de cada categoria)
-- =====================================================
create table if not exists options (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  image_url text,
  display_order int default 0,
  created_at timestamptz default now()
);

-- =====================================================
-- TABELA: votes
-- um voto por (categoria + identificador do eleitor)
-- =====================================================
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  option_id uuid not null references options(id) on delete cascade,
  voter_hash text not null,
  voter_ip text,
  created_at timestamptz default now(),
  unique (category_id, voter_hash)
);

-- =====================================================
-- INDICES
-- =====================================================
create index if not exists idx_options_category on options(category_id);
create index if not exists idx_votes_category on votes(category_id);
create index if not exists idx_votes_option on votes(option_id);
create index if not exists idx_categories_status on categories(status);

-- =====================================================
-- ROW LEVEL SECURITY
-- Backend usa a service_role key (bypassa RLS), entao o
-- RLS aqui e uma camada extra de protecao caso a anon key
-- seja usada em algum lugar por engano.
-- =====================================================
alter table admins enable row level security;
alter table site_settings enable row level security;
alter table categories enable row level security;
alter table options enable row level security;
alter table votes enable row level security;

-- leitura publica de categorias/opcoes/config (somente SELECT)
drop policy if exists "public read categories" on categories;
create policy "public read categories" on categories for select using (true);

drop policy if exists "public read options" on options;
create policy "public read options" on options for select using (true);

drop policy if exists "public read settings" on site_settings;
create policy "public read settings" on site_settings for select using (true);

-- nenhuma policy de insert/update/delete publica: somente a
-- service_role key (usada pelo backend) pode escrever.

-- =====================================================
-- STORAGE: bucket publico para imagens
-- Rode isso tambem, ou crie o bucket manualmente pelo
-- painel Supabase > Storage > New bucket > "site-media" > Public
-- =====================================================
insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do nothing;

drop policy if exists "public read site-media" on storage.objects;
create policy "public read site-media" on storage.objects
  for select using (bucket_id = 'site-media');
