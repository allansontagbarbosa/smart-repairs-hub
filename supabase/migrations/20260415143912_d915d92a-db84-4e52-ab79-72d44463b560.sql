-- empresa_config: add rua (outros já foram adicionados na migration anterior)
ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS rua TEXT;

-- empresas: add individual address columns
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS rua TEXT,
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS complemento TEXT;

-- user_profiles: add ativo column
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

-- Clean up duplicate perfis_acesso
DELETE FROM public.perfis_acesso a
USING public.perfis_acesso b
WHERE a.id > b.id
  AND a.nome_perfil = b.nome_perfil
  AND a.empresa_id IS NOT DISTINCT FROM b.empresa_id;

-- Ensure all existing user_profiles have ativo = true
UPDATE public.user_profiles SET ativo = true WHERE ativo IS NULL;

NOTIFY pgrst, 'reload schema';