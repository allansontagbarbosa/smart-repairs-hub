create or replace function admin.is_staff()
returns boolean
language sql
stable
security definer
set search_path = admin, public
as $$
  select
    current_setting('request.jwt.claim.role', true) = 'service_role'
    or current_setting('role', true) = 'service_role'
    or exists (
      select 1
      from admin.usuarios_internos
      where user_id = auth.uid()
        and ativo = true
    );
$$;