create or replace function public.listar_tecnicos_os()
returns table (id uuid, nome text, cargo text)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.nome, f.cargo
  from public.funcionarios f
  where f.empresa_id = public.get_my_empresa_id()
    and f.ativo = true
    and f.deleted_at is null
  order by f.nome
$$;

revoke all on function public.listar_tecnicos_os() from public, anon;
grant execute on function public.listar_tecnicos_os() to authenticated;