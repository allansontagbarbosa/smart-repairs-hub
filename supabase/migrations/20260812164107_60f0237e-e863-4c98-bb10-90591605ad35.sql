create or replace function public.vincular_funcionario_usuario(
  p_user_profile_id uuid,
  p_funcionario_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_empresa uuid;
  v_profile record;
  v_func record;
  v_outro uuid;
begin
  v_empresa := public.get_my_empresa_id();
  if v_empresa is null then
    return jsonb_build_object('success', false, 'error', 'Sem empresa');
  end if;
  if not public.is_admin_ou_gerente() then
    return jsonb_build_object('success', false, 'error', 'Sem permissão');
  end if;

  select id, funcionario_id, nome_exibicao into v_profile
    from public.user_profiles
   where id = p_user_profile_id and empresa_id = v_empresa;

  if v_profile.id is null then
    return jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  end if;

  if p_funcionario_id is not null then
    select id, nome into v_func
      from public.funcionarios
     where id = p_funcionario_id and empresa_id = v_empresa;

    if v_func.id is null then
      return jsonb_build_object('success', false, 'error', 'Funcionário não encontrado');
    end if;

    select id into v_outro
      from public.user_profiles
     where funcionario_id = p_funcionario_id
       and empresa_id = v_empresa
       and id <> p_user_profile_id
     limit 1;

    if v_outro is not null then
      return jsonb_build_object('success', false, 'error', 'Funcionário já vinculado a outro usuário');
    end if;
  end if;

  update public.user_profiles
     set funcionario_id = p_funcionario_id
   where id = p_user_profile_id and empresa_id = v_empresa;

  return jsonb_build_object(
    'success', true,
    'funcionario_id', p_funcionario_id,
    'funcionario_nome', v_func.nome
  );
end;
$function$;

revoke all on function public.vincular_funcionario_usuario(uuid, uuid) from public;
grant execute on function public.vincular_funcionario_usuario(uuid, uuid) to authenticated;