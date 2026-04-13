
create or replace function public.get_clientes_com_stats()
returns table (
  id uuid,
  nome text,
  telefone text,
  whatsapp text,
  email text,
  cpf text,
  observacoes text,
  created_at timestamptz,
  total_os bigint,
  total_gasto numeric,
  ultimo_atendimento timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.nome, c.telefone, c.whatsapp, c.email, c.cpf,
    c.observacoes, c.created_at,
    count(os.id) as total_os,
    coalesce(sum(os.valor), 0) as total_gasto,
    max(os.data_entrada) as ultimo_atendimento
  from clientes c
  left join aparelhos a on a.cliente_id = c.id
  left join ordens_de_servico os on os.aparelho_id = a.id
  where c.deleted_at is null
  group by c.id
  order by c.nome;
$$;
