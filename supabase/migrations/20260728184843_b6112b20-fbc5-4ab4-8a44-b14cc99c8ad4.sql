create or replace function public.current_user_email_confirmed()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null
  )
$$;

revoke all on function public.current_user_email_confirmed() from public, anon;
grant execute on function public.current_user_email_confirmed() to authenticated, service_role;

drop policy if exists "lojista_select_por_email_nao_reivindicado" on public.lojista_usuarios;

create policy "lojista_select_por_email_nao_reivindicado"
on public.lojista_usuarios
for select
to authenticated
using (
  user_id is null
  and lower(email) = lower((auth.jwt() ->> 'email'))
  and public.current_user_email_confirmed()
);