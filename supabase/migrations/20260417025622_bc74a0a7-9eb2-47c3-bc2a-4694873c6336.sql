-- Adicionar colunas de fluxo de convite à tabela lojistas
ALTER TABLE public.lojistas
  ADD COLUMN IF NOT EXISTS status_acesso text NOT NULL DEFAULT 'nao_convidado',
  ADD COLUMN IF NOT EXISTS convite_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS convite_aceito_em timestamptz,
  ADD COLUMN IF NOT EXISTS convite_token text,
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Constraint de valores válidos
ALTER TABLE public.lojistas
  DROP CONSTRAINT IF EXISTS lojistas_status_acesso_check;
ALTER TABLE public.lojistas
  ADD CONSTRAINT lojistas_status_acesso_check
  CHECK (status_acesso IN ('nao_convidado','convidado','ativo','inativo'));

-- Índice único em token (apenas quando não nulo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_lojistas_convite_token
  ON public.lojistas(convite_token) WHERE convite_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lojistas_user_id
  ON public.lojistas(user_id) WHERE user_id IS NOT NULL;

-- Backfill: quem já tem vínculo ativo em lojista_usuarios passa para 'ativo'
UPDATE public.lojistas l
SET status_acesso = 'ativo',
    convite_aceito_em = COALESCE(convite_aceito_em, now()),
    user_id = lu.user_id
FROM public.lojista_usuarios lu
WHERE lu.lojista_id = l.id
  AND lu.ativo = true
  AND lu.user_id IS NOT NULL
  AND l.status_acesso = 'nao_convidado';

-- Política RLS para validar token público de convite (sem auth)
DROP POLICY IF EXISTS "anon_validar_convite_token" ON public.lojistas;
CREATE POLICY "anon_validar_convite_token" ON public.lojistas
FOR SELECT TO anon
USING (convite_token IS NOT NULL AND status_acesso = 'convidado');