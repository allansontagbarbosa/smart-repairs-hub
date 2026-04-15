
-- Delete user_profiles
DELETE FROM public.user_profiles WHERE user_id = 'dca8a61a-af28-4228-91d7-7f890debd38b';

-- Delete funcionarios
DELETE FROM public.funcionarios WHERE id = 'c64b5a49-641c-416e-b28a-c953cfd56eb1';

-- Delete perfis_acesso for both empresas
DELETE FROM public.perfis_acesso WHERE empresa_id IN ('1aac749f-22b4-4863-81af-662ac0229e2c', '8596f94f-5258-495e-99be-c3e56b0e24c3');

-- Delete empresa_config
DELETE FROM public.empresa_config WHERE empresa_id IN ('1aac749f-22b4-4863-81af-662ac0229e2c', '8596f94f-5258-495e-99be-c3e56b0e24c3');

-- Delete empresas owned by this user
DELETE FROM public.empresas WHERE owner_id = 'dca8a61a-af28-4228-91d7-7f890debd38b';

-- Delete auth user
DELETE FROM auth.users WHERE id = 'dca8a61a-af28-4228-91d7-7f890debd38b';
