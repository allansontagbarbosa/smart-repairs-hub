-- 1a. Corrigir user_profiles onde user_id está NULL mas id = auth user id
UPDATE public.user_profiles
SET user_id = id
WHERE user_id IS NULL AND id IS NOT NULL;

-- 1b. Garantir que empresa_id está preenchido em todos os perfis ativos
UPDATE public.user_profiles
SET empresa_id = (
  SELECT id FROM public.empresas ORDER BY criado_em ASC LIMIT 1
)
WHERE empresa_id IS NULL AND ativo = true;

-- 1c. Recriar get_my_empresa_id para buscar por AMBAS as colunas
CREATE OR REPLACE FUNCTION public.get_my_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id
  FROM public.user_profiles
  WHERE (user_id = auth.uid() OR id = auth.uid())
    AND ativo = true
    AND empresa_id IS NOT NULL
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- 1d. Corrigir todos os registros históricos com empresa_id NULL
UPDATE public.contas_a_pagar
SET empresa_id = (SELECT id FROM public.empresas ORDER BY criado_em ASC LIMIT 1)
WHERE empresa_id IS NULL;

UPDATE public.recebimentos
SET empresa_id = (SELECT id FROM public.empresas ORDER BY criado_em ASC LIMIT 1)
WHERE empresa_id IS NULL;

UPDATE public.comissoes
SET empresa_id = (SELECT id FROM public.empresas ORDER BY criado_em ASC LIMIT 1)
WHERE empresa_id IS NULL;

UPDATE public.socios
SET empresa_id = (SELECT id FROM public.empresas ORDER BY criado_em ASC LIMIT 1)
WHERE empresa_id IS NULL;

UPDATE public.ajustes_mensais
SET empresa_id = (SELECT id FROM public.empresas ORDER BY criado_em ASC LIMIT 1)
WHERE empresa_id IS NULL;

NOTIFY pgrst, 'reload schema';