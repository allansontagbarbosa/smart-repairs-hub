-- Corrigir todos os user_profiles onde ativo é NULL
UPDATE public.user_profiles
SET ativo = true
WHERE ativo IS NULL;

-- Garantir que novos registros sempre tenham ativo = true por padrão
ALTER TABLE public.user_profiles
  ALTER COLUMN ativo SET DEFAULT true;

NOTIFY pgrst, 'reload schema';