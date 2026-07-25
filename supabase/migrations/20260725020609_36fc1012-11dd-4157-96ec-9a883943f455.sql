
create or replace function public.is_staff(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    current_setting('request.jwt.claim.role', true) = 'service_role'
    or exists (
      select 1
      from admin.usuarios_internos
      where user_id = _uid
        and ativo = true
    );
$$;
