-- Drop the global unique constraint on nome_perfil
ALTER TABLE public.perfis_acesso DROP CONSTRAINT IF EXISTS perfis_acesso_nome_unique;
ALTER TABLE public.perfis_acesso DROP CONSTRAINT IF EXISTS perfis_acesso_nome_perfil_key;

-- Add unique constraint per empresa instead
CREATE UNIQUE INDEX IF NOT EXISTS perfis_acesso_empresa_nome_unique 
  ON public.perfis_acesso (empresa_id, nome_perfil) 
  WHERE empresa_id IS NOT NULL;