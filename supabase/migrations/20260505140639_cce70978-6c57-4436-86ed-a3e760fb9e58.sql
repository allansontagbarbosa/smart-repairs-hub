-- Limpar usuário fantasma de teste CORS
DELETE FROM public.user_profiles WHERE user_id = 'b65cd9b7-e9bd-48dc-9350-a516fc3bdba3';
DELETE FROM public.funcionarios WHERE id = '0f77b19e-985d-48e4-ae58-7d4872665ccb';
DELETE FROM auth.users WHERE id = 'b65cd9b7-e9bd-48dc-9350-a516fc3bdba3';