-- Desativar user_profiles de usuários que são lojistas
-- (não devem aparecer como funcionários do sistema)
UPDATE public.user_profiles
SET ativo = false
WHERE user_id IN (
  SELECT user_id 
  FROM public.lojista_usuarios 
  WHERE ativo = true
    AND user_id != '00000000-0000-0000-0000-000000000000'
)
AND empresa_id IS NOT NULL;

-- Recarregar schema do PostgREST
NOTIFY pgrst, 'reload schema';