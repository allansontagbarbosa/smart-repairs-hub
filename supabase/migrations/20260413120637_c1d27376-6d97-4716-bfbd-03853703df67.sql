create table public.recebimentos (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  valor numeric(10,2) not null,
  data_recebimento date not null,
  forma_pagamento text not null default 'dinheiro',
  ordem_servico_id uuid references public.ordens_de_servico(id) on delete set null,
  cliente_id uuid references public.clientes(id) on delete set null,
  loja_id uuid references public.lojas(id) on delete set null,
  observacoes text,
  created_at timestamptz not null default now()
);

alter table public.recebimentos enable row level security;

create policy "Authenticated full access" on public.recebimentos for all to authenticated using (true) with check (true);

create index idx_recebimentos_data on public.recebimentos(data_recebimento);