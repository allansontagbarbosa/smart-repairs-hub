
ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS backup_email_destino text,
  ADD COLUMN IF NOT EXISTS backup_frequencia text DEFAULT 'desativado'
    CHECK (backup_frequencia IN ('desativado','diario','semanal','mensal')),
  ADD COLUMN IF NOT EXISTS backup_dia_semana int
    CHECK (backup_dia_semana IS NULL OR backup_dia_semana BETWEEN 0 AND 6),
  ADD COLUMN IF NOT EXISTS backup_hora int DEFAULT 3
    CHECK (backup_hora BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS backup_ultimo_envio_em timestamptz;

CREATE TABLE IF NOT EXISTS public.backup_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  iniciado_por_user_id uuid REFERENCES auth.users(id),
  tipo text NOT NULL CHECK (tipo IN ('manual','automatico','pre_migration')),
  status text NOT NULL CHECK (status IN ('processando','sucesso','erro')),
  email_destino text,
  arquivo_xlsx_bytes int,
  arquivo_json_bytes int,
  tabelas_incluidas text[],
  contagem_registros jsonb,
  erro_mensagem text,
  iniciado_em timestamptz DEFAULT now(),
  concluido_em timestamptz
);

CREATE INDEX IF NOT EXISTS idx_backup_historico_empresa
  ON public.backup_historico(empresa_id, iniciado_em DESC);

ALTER TABLE public.backup_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa vê seus backups" ON public.backup_historico;
CREATE POLICY "Empresa vê seus backups" ON public.backup_historico
FOR SELECT USING (
  empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Admin gerencia backups da empresa" ON public.backup_historico;
CREATE POLICY "Admin gerencia backups da empresa" ON public.backup_historico
FOR ALL USING (
  empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid())
) WITH CHECK (
  empresa_id IN (SELECT empresa_id FROM user_profiles WHERE user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.coletar_dados_backup(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb := '{}'::jsonb;
  v_user_empresa uuid;
BEGIN
  SELECT empresa_id INTO v_user_empresa
    FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;

  IF v_user_empresa IS NULL OR v_user_empresa != p_empresa_id THEN
    RAISE EXCEPTION 'Sem permissão pra empresa %', p_empresa_id;
  END IF;

  v_resultado := v_resultado || jsonb_build_object('empresa_config',
    (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
      SELECT * FROM empresa_config WHERE empresa_id = p_empresa_id
    ) t));

  v_resultado := v_resultado || jsonb_build_object('socios',
    (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
      SELECT * FROM socios WHERE empresa_id = p_empresa_id AND deleted_at IS NULL
    ) t));

  BEGIN
    v_resultado := v_resultado || jsonb_build_object('socio_metas',
      (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT * FROM socio_metas WHERE empresa_id = p_empresa_id
      ) t));
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  v_resultado := v_resultado || jsonb_build_object('funcionarios',
    (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
      SELECT * FROM funcionarios WHERE empresa_id = p_empresa_id AND deleted_at IS NULL
    ) t));

  BEGIN
    v_resultado := v_resultado || jsonb_build_object('funcionario_movimentacoes',
      (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT fm.* FROM funcionario_movimentacoes fm
        JOIN funcionarios f ON f.id = fm.funcionario_id
        WHERE f.empresa_id = p_empresa_id
      ) t));
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  v_resultado := v_resultado || jsonb_build_object('clientes',
    (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
      SELECT * FROM clientes WHERE empresa_id = p_empresa_id AND deleted_at IS NULL
    ) t));

  BEGIN
    v_resultado := v_resultado || jsonb_build_object('lojista_grupos',
      (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT * FROM lojista_grupos WHERE empresa_id = p_empresa_id AND deleted_at IS NULL
      ) t));
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  v_resultado := v_resultado || jsonb_build_object('fornecedores',
    (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
      SELECT * FROM fornecedores WHERE empresa_id = p_empresa_id AND deleted_at IS NULL
    ) t));

  v_resultado := v_resultado || jsonb_build_object('tipos_servico',
    (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
      SELECT * FROM tipos_servico WHERE empresa_id = p_empresa_id AND deleted_at IS NULL
    ) t));

  v_resultado := v_resultado || jsonb_build_object('aparelhos',
    (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
      SELECT * FROM aparelhos WHERE empresa_id = p_empresa_id AND deleted_at IS NULL
    ) t));

  v_resultado := v_resultado || jsonb_build_object('ordens_de_servico',
    (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
      SELECT * FROM ordens_de_servico WHERE empresa_id = p_empresa_id AND deleted_at IS NULL
    ) t));

  v_resultado := v_resultado || jsonb_build_object('os_servicos',
    (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
      SELECT * FROM os_servicos WHERE empresa_id = p_empresa_id
    ) t));

  v_resultado := v_resultado || jsonb_build_object('comissoes',
    (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
      SELECT * FROM comissoes WHERE empresa_id = p_empresa_id
    ) t));

  v_resultado := v_resultado || jsonb_build_object('contas_a_pagar',
    (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
      SELECT * FROM contas_a_pagar WHERE empresa_id = p_empresa_id AND deleted_at IS NULL
    ) t));

  v_resultado := v_resultado || jsonb_build_object('movimentacoes_financeiras',
    (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
      SELECT * FROM movimentacoes_financeiras WHERE empresa_id = p_empresa_id
    ) t));

  BEGIN
    v_resultado := v_resultado || jsonb_build_object('ajustes_mensais',
      (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT * FROM ajustes_mensais WHERE empresa_id = p_empresa_id
      ) t));
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  BEGIN
    v_resultado := v_resultado || jsonb_build_object('prejuizos',
      (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT * FROM prejuizos WHERE empresa_id = p_empresa_id AND deleted_at IS NULL
      ) t));
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  BEGIN
    v_resultado := v_resultado || jsonb_build_object('garantias',
      (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT * FROM garantias WHERE empresa_id = p_empresa_id
      ) t));
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  BEGIN
    v_resultado := v_resultado || jsonb_build_object('etiqueta_templates',
      (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT * FROM etiqueta_templates WHERE empresa_id = p_empresa_id AND deleted_at IS NULL
      ) t));
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  BEGIN
    v_resultado := v_resultado || jsonb_build_object('os_pecas',
      (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT op.* FROM os_pecas op
        JOIN ordens_de_servico o ON o.id = op.ordem_id
        WHERE o.empresa_id = p_empresa_id
      ) t));
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  BEGIN
    v_resultado := v_resultado || jsonb_build_object('modelos_documento',
      (SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT * FROM modelos_documento WHERE empresa_id = p_empresa_id
      ) t));
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END;

  v_resultado := v_resultado || jsonb_build_object('_meta', jsonb_build_object(
    'gerado_em', now(),
    'gerado_por_user_id', auth.uid(),
    'empresa_id', p_empresa_id,
    'versao_backup', '1.0',
    'contagem', (SELECT jsonb_object_agg(k, jsonb_array_length(v))
                 FROM jsonb_each(v_resultado) AS x(k, v)
                 WHERE k != '_meta' AND jsonb_typeof(v) = 'array')
  ));

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.coletar_dados_backup TO authenticated;
