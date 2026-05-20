-- Validar pré-requisitos
DO $$
DECLARE
  v_missing text := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='lojistas') THEN
    v_missing := v_missing || 'lojistas, ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='empresas') THEN
    v_missing := v_missing || 'empresas, ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ordens_de_servico' AND column_name='loja_id') THEN
    v_missing := v_missing || 'ordens_de_servico.loja_id, ';
  END IF;
  IF v_missing != '' THEN
    RAISE EXCEPTION 'Schema check falhou — faltam: %', v_missing;
  END IF;
END$$;

-- Tabela de grupos
CREATE TABLE IF NOT EXISTS public.lojista_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  nome text NOT NULL,
  razao_social text,
  cnpj_matriz text,
  email text,
  telefone text,
  responsavel text,
  observacoes text,
  user_id uuid REFERENCES auth.users(id),
  ativo boolean DEFAULT true,
  status_acesso text DEFAULT 'nao_convidado',
  convite_enviado_em timestamptz,
  convite_aceito_em timestamptz,
  convite_token text,
  convite_expira_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_lojista_grupos_empresa ON public.lojista_grupos(empresa_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lojista_grupos_user ON public.lojista_grupos(user_id) WHERE deleted_at IS NULL AND user_id IS NOT NULL;

ALTER TABLE public.lojistas ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES public.lojista_grupos(id);
CREATE INDEX IF NOT EXISTS idx_lojistas_grupo ON public.lojistas(grupo_id) WHERE grupo_id IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_lojista_grupos_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_lojista_grupos_updated_at ON public.lojista_grupos;
CREATE TRIGGER trg_lojista_grupos_updated_at
  BEFORE UPDATE ON public.lojista_grupos
  FOR EACH ROW EXECUTE FUNCTION public.set_lojista_grupos_updated_at();

ALTER TABLE public.lojista_grupos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa vê seus grupos" ON public.lojista_grupos;
CREATE POLICY "Empresa vê seus grupos" ON public.lojista_grupos
FOR SELECT USING (
  empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid())
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Admin gerencia grupos da empresa" ON public.lojista_grupos;
CREATE POLICY "Admin gerencia grupos da empresa" ON public.lojista_grupos
FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid())
) WITH CHECK (
  empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid())
);

-- RPC contexto
CREATE OR REPLACE FUNCTION public.get_lojista_contexto()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_grupo record;
  v_lojista record;
  v_lojas_grupo jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('tipo', 'anonimo');
  END IF;

  SELECT id, empresa_id, nome, razao_social, cnpj_matriz, email
    INTO v_grupo
    FROM public.lojista_grupos
    WHERE user_id = v_user_id AND ativo = true AND deleted_at IS NULL
    LIMIT 1;

  IF v_grupo.id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', l.id, 'nome', l.nome, 'razao_social', l.razao_social,
      'cnpj', l.cnpj, 'email', l.email, 'telefone', l.telefone, 'ativo', l.ativo
    ) ORDER BY l.nome), '[]'::jsonb)
      INTO v_lojas_grupo
      FROM public.lojistas l
      WHERE l.grupo_id = v_grupo.id AND l.ativo = true AND l.deleted_at IS NULL;

    RETURN jsonb_build_object(
      'tipo', 'grupo',
      'grupo_id', v_grupo.id,
      'grupo_nome', v_grupo.nome,
      'empresa_id', v_grupo.empresa_id,
      'lojas', v_lojas_grupo,
      'qtd_lojas', jsonb_array_length(v_lojas_grupo)
    );
  END IF;

  SELECT id, empresa_id, nome, razao_social, cnpj, email
    INTO v_lojista
    FROM public.lojistas
    WHERE user_id = v_user_id AND ativo = true AND deleted_at IS NULL
    LIMIT 1;

  IF v_lojista.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'tipo', 'individual',
      'lojista_id', v_lojista.id,
      'lojista_nome', v_lojista.nome,
      'empresa_id', v_lojista.empresa_id,
      'lojas', jsonb_build_array(jsonb_build_object(
        'id', v_lojista.id, 'nome', v_lojista.nome,
        'razao_social', v_lojista.razao_social, 'cnpj', v_lojista.cnpj,
        'email', v_lojista.email
      ))
    );
  END IF;

  RETURN jsonb_build_object('tipo', 'nao_lojista');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lojista_contexto TO authenticated;