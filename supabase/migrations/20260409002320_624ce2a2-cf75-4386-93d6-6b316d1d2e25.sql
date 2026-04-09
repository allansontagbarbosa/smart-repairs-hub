
-- Enums
create type public.status_ordem as enum (
  'aguardando_orcamento',
  'orcamento_aprovado',
  'em_reparo',
  'pronto',
  'entregue',
  'cancelado'
);

create type public.tipo_movimentacao as enum (
  'entrada',
  'saida'
);

-- 1. Clientes
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  email text,
  observacoes text,
  created_at timestamptz not null default now()
);

-- 2. Aparelhos
create table public.aparelhos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade not null,
  marca text not null,
  modelo text not null,
  cor text,
  imei text,
  observacoes text,
  created_at timestamptz not null default now()
);

-- 3. Ordens de Serviço
create table public.ordens_de_servico (
  id uuid primary key default gen_random_uuid(),
  numero serial,
  aparelho_id uuid references public.aparelhos(id) on delete cascade not null,
  defeito_relatado text not null,
  diagnostico text,
  servico_realizado text,
  valor numeric(10,2) default 0,
  custo_pecas numeric(10,2) default 0,
  status status_ordem default 'aguardando_orcamento' not null,
  data_entrada timestamptz not null default now(),
  data_conclusao timestamptz,
  data_entrega timestamptz,
  observacoes text,
  created_at timestamptz not null default now()
);

-- 4. Estoque
create table public.estoque (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text,
  quantidade integer not null default 0,
  quantidade_minima integer not null default 0,
  preco_custo numeric(10,2) default 0,
  preco_venda numeric(10,2) default 0,
  created_at timestamptz not null default now()
);

-- 5. Movimentações Financeiras
create table public.movimentacoes_financeiras (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_movimentacao not null,
  descricao text not null,
  valor numeric(10,2) not null,
  ordem_id uuid references public.ordens_de_servico(id) on delete set null,
  estoque_id uuid references public.estoque(id) on delete set null,
  data timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_aparelhos_cliente on public.aparelhos(cliente_id);
create index idx_ordens_aparelho on public.ordens_de_servico(aparelho_id);
create index idx_ordens_status on public.ordens_de_servico(status);
create index idx_movimentacoes_tipo on public.movimentacoes_financeiras(tipo);
create index idx_movimentacoes_data on public.movimentacoes_financeiras(data);
create index idx_estoque_categoria on public.estoque(categoria);

-- RLS
alter table public.clientes enable row level security;
alter table public.aparelhos enable row level security;
alter table public.ordens_de_servico enable row level security;
alter table public.estoque enable row level security;
alter table public.movimentacoes_financeiras enable row level security;

-- Policies: full access for authenticated users (single-tenant system)
create policy "Authenticated full access" on public.clientes for all to authenticated using (true) with check (true);
create policy "Authenticated full access" on public.aparelhos for all to authenticated using (true) with check (true);
create policy "Authenticated full access" on public.ordens_de_servico for all to authenticated using (true) with check (true);
create policy "Authenticated full access" on public.estoque for all to authenticated using (true) with check (true);
create policy "Authenticated full access" on public.movimentacoes_financeiras for all to authenticated using (true) with check (true);

-- Anon read for client lookup (future client portal)
create policy "Anon read orders" on public.ordens_de_servico for select to anon using (true);
