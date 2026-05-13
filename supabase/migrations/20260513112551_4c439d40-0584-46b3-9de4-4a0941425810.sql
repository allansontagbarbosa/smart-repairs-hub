
CREATE TABLE IF NOT EXISTS public.tv_paineis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  codigo text NOT NULL UNIQUE,
  tema text NOT NULL DEFAULT 'dark' CHECK (tema IN ('dark', 'light')),
  orientacao text NOT NULL DEFAULT 'auto' CHECK (orientacao IN ('auto', 'landscape', 'portrait')),
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  intervalo_refresh_segundos int NOT NULL DEFAULT 30,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_acesso_em timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tv_paineis_codigo ON public.tv_paineis(codigo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_tv_paineis_empresa ON public.tv_paineis(empresa_id);

ALTER TABLE public.tv_paineis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tv_paineis_empresa_isolada"
  ON public.tv_paineis FOR ALL
  TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- Gera código único de 6 dígitos
CREATE OR REPLACE FUNCTION public.gerar_codigo_tv()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo text;
  v_tentativas int := 0;
BEGIN
  LOOP
    v_codigo := lpad((floor(random() * 1000000))::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tv_paineis WHERE codigo = v_codigo);
    v_tentativas := v_tentativas + 1;
    IF v_tentativas > 50 THEN
      RAISE EXCEPTION 'Não foi possível gerar código único';
    END IF;
  END LOOP;
  RETURN v_codigo;
END;
$$;

CREATE OR REPLACE FUNCTION public.tv_criar_painel(
  p_nome text,
  p_widgets jsonb,
  p_tema text DEFAULT 'dark',
  p_orientacao text DEFAULT 'auto',
  p_intervalo_refresh int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_codigo text;
  v_painel_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  v_codigo := public.gerar_codigo_tv();

  INSERT INTO public.tv_paineis (empresa_id, nome, codigo, tema, orientacao, widgets, intervalo_refresh_segundos, created_by)
  VALUES (v_empresa_id, p_nome, v_codigo, p_tema, p_orientacao, p_widgets, p_intervalo_refresh, auth.uid())
  RETURNING id INTO v_painel_id;

  RETURN jsonb_build_object('success', true, 'painel_id', v_painel_id, 'codigo', v_codigo);
END;
$$;

CREATE OR REPLACE FUNCTION public.tv_atualizar_painel(
  p_painel_id uuid,
  p_nome text DEFAULT NULL,
  p_widgets jsonb DEFAULT NULL,
  p_tema text DEFAULT NULL,
  p_orientacao text DEFAULT NULL,
  p_intervalo_refresh int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1;

  UPDATE public.tv_paineis SET
    nome = COALESCE(p_nome, nome),
    widgets = COALESCE(p_widgets, widgets),
    tema = COALESCE(p_tema, tema),
    orientacao = COALESCE(p_orientacao, orientacao),
    intervalo_refresh_segundos = COALESCE(p_intervalo_refresh, intervalo_refresh_segundos),
    updated_at = now()
  WHERE id = p_painel_id AND empresa_id = v_empresa_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.tv_regenerar_codigo(p_painel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_novo_codigo text;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1;

  v_novo_codigo := public.gerar_codigo_tv();

  UPDATE public.tv_paineis SET
    codigo = v_novo_codigo,
    updated_at = now()
  WHERE id = p_painel_id AND empresa_id = v_empresa_id;

  RETURN jsonb_build_object('success', true, 'novo_codigo', v_novo_codigo);
END;
$$;

-- Pública: dados do painel pelo código (sem auth)
CREATE OR REPLACE FUNCTION public.tv_get_painel_data(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_painel record;
  v_empresa_nome text;
  v_kpis jsonb;
  v_podio jsonb;
  v_meta jsonb;
  v_aparelhos jsonb;
  v_alertas jsonb;
  v_lojistas jsonb;
  v_hoje date := CURRENT_DATE;
  v_inicio_mes date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  SELECT * INTO v_painel FROM public.tv_paineis
  WHERE codigo = p_codigo AND ativo = true LIMIT 1;

  IF v_painel IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código inválido');
  END IF;

  UPDATE public.tv_paineis SET ultimo_acesso_em = now() WHERE id = v_painel.id;

  SELECT nome INTO v_empresa_nome FROM public.empresas WHERE id = v_painel.empresa_id;

  SELECT jsonb_build_object(
    'oss_hoje', COUNT(*) FILTER (WHERE data_entrega::date = v_hoje),
    'faturamento_hoje', COALESCE(SUM(valor_total) FILTER (WHERE data_entrega::date = v_hoje), 0),
    'faturamento_mes', COALESCE(SUM(valor_total) FILTER (WHERE data_entrega >= v_inicio_mes), 0),
    'aparelhos_abertos', (SELECT COUNT(*) FROM public.ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id
        AND status NOT IN ('entregue', 'cancelado') AND deleted_at IS NULL),
    'prontos_retirar', (SELECT COUNT(*) FROM public.ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id
        AND status = 'pronto' AND deleted_at IS NULL)
  ) INTO v_kpis
  FROM public.ordens_de_servico
  WHERE empresa_id = v_painel.empresa_id AND status = 'entregue' AND deleted_at IS NULL;

  SELECT jsonb_agg(jsonb_build_object(
    'nome', f.nome,
    'oss', t.qtd_oss,
    'comissao', t.total_comissao
  ) ORDER BY t.qtd_oss DESC) INTO v_podio
  FROM (
    SELECT c.funcionario_id, COUNT(*) AS qtd_oss, SUM(c.valor) AS total_comissao
    FROM public.comissoes c
    WHERE c.empresa_id = v_painel.empresa_id
      AND c.mes_competencia = to_char(v_hoje, 'YYYY-MM')
      AND c.estornada_em IS NULL
    GROUP BY c.funcionario_id
    ORDER BY qtd_oss DESC
    LIMIT 3
  ) t
  JOIN public.funcionarios f ON f.id = t.funcionario_id;

  SELECT jsonb_build_object(
    'meta_valor', 130000,
    'atual_valor', COALESCE(SUM(valor_total), 0),
    'pct', LEAST(100, (COALESCE(SUM(valor_total), 0) / 130000.0 * 100)::int)
  ) INTO v_meta
  FROM public.ordens_de_servico
  WHERE empresa_id = v_painel.empresa_id
    AND status = 'entregue' AND deleted_at IS NULL
    AND data_entrega >= v_inicio_mes;

  SELECT jsonb_agg(jsonb_build_object('nome', f.nome, 'qtd', t.qtd) ORDER BY t.qtd DESC) INTO v_aparelhos
  FROM (
    SELECT os.funcionario_id, COUNT(*) AS qtd
    FROM public.ordens_de_servico os
    WHERE os.empresa_id = v_painel.empresa_id
      AND os.status NOT IN ('entregue', 'cancelado')
      AND os.deleted_at IS NULL
      AND os.funcionario_id IS NOT NULL
    GROUP BY os.funcionario_id
  ) t
  JOIN public.funcionarios f ON f.id = t.funcionario_id;

  SELECT jsonb_build_object(
    'prontas_paradas', (
      SELECT COUNT(*) FROM public.ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id
        AND status = 'pronto' AND deleted_at IS NULL
        AND updated_at < (now() - interval '7 days')
    ),
    'aguardando_aprovacao_2dias', (
      SELECT COUNT(*) FROM public.ordens_de_servico
      WHERE empresa_id = v_painel.empresa_id
        AND status = 'aguardando_aprovacao' AND deleted_at IS NULL
        AND updated_at < (now() - interval '2 days')
    ),
    'estoque_baixo', (
      SELECT COUNT(*) FROM public.estoque_itens
      WHERE empresa_id = v_painel.empresa_id
        AND ativo = true AND deleted_at IS NULL
        AND quantidade <= COALESCE(quantidade_minima, 0)
    )
  ) INTO v_alertas;

  SELECT jsonb_agg(jsonb_build_object('nome', t.nome, 'saldo', t.saldo) ORDER BY t.saldo DESC) INTO v_lojistas
  FROM (
    SELECT c.nome, SUM(COALESCE(os.valor_total, 0) - COALESCE(os.valor_pago, 0)) AS saldo
    FROM public.clientes c
    JOIN public.ordens_de_servico os ON os.cliente_id = c.id
    WHERE c.empresa_id = v_painel.empresa_id
      AND os.status = 'entregue'
      AND COALESCE(os.valor_pago, 0) < COALESCE(os.valor_total, 0)
      AND os.deleted_at IS NULL
    GROUP BY c.id, c.nome
    ORDER BY saldo DESC
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'success', true,
    'painel', jsonb_build_object(
      'id', v_painel.id,
      'nome', v_painel.nome,
      'tema', v_painel.tema,
      'orientacao', v_painel.orientacao,
      'widgets', v_painel.widgets,
      'intervalo_refresh', v_painel.intervalo_refresh_segundos,
      'empresa_nome', v_empresa_nome
    ),
    'dados', jsonb_build_object(
      'kpis', v_kpis,
      'podio', v_podio,
      'meta', v_meta,
      'aparelhos_tecnicos', v_aparelhos,
      'alertas', v_alertas,
      'top_lojistas', v_lojistas,
      'gerado_em', now()
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tv_get_painel_data(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tv_criar_painel(text, jsonb, text, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tv_atualizar_painel(uuid, text, jsonb, text, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tv_regenerar_codigo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_codigo_tv() TO authenticated;
