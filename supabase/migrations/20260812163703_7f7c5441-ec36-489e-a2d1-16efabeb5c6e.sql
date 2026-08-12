create or replace function public.listar_emails_usuarios()
returns table(user_id uuid, email text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select up.user_id, au.email::text
  from public.user_profiles up
  join auth.users au on au.id = up.user_id
  where up.empresa_id = public.get_my_empresa_id()
    and public.is_adm_ou_socio()
$$;

revoke all on function public.listar_emails_usuarios() from public;
grant execute on function public.listar_emails_usuarios() to authenticated;