BEGIN;

CREATE OR REPLACE FUNCTION public.get_dashboard_bancadas()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa UUID;
  v_resultado JSONB;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'data', COALESCE(jsonb_agg(b ORDER BY b.qtd_total DESC, b.nome ASC), '[]'::jsonb)
  )
  INTO v_resultado
  FROM (
    SELECT
      f.id AS funcionario_id,
      f.nome AS nome,
      (SELECT COUNT(*) FROM public.ordens_de_servico os
        WHERE os.tecnico_responsavel_id = f.id
          AND os.empresa_id = v_empresa
          AND os.deleted_at IS NULL
          AND public.os_status_em_casa(os.status::text) = TRUE
      )::INTEGER AS qtd_total,
      (SELECT COUNT(*) FROM public.ordens_de_servico os
        WHERE os.tecnico_responsavel_id = f.id
          AND os.empresa_id = v_empresa
          AND os.deleted_at IS NULL
          AND public.os_status_mapear_legado(os.status::text) = 'recebido'
      )::INTEGER AS qtd_recebido,
      (SELECT COUNT(*) FROM public.ordens_de_servico os
        WHERE os.tecnico_responsavel_id = f.id
          AND os.empresa_id = v_empresa
          AND os.deleted_at IS NULL
          AND public.os_status_mapear_legado(os.status::text) = 'em_analise'
      )::INTEGER AS qtd_em_analise,
      (SELECT COUNT(*) FROM public.ordens_de_servico os
        WHERE os.tecnico_responsavel_id = f.id
          AND os.empresa_id = v_empresa
          AND os.deleted_at IS NULL
          AND public.os_status_mapear_legado(os.status::text) = 'aprovacao'
      )::INTEGER AS qtd_aprovacao,
      (SELECT COUNT(*) FROM public.ordens_de_servico os
        WHERE os.tecnico_responsavel_id = f.id
          AND os.empresa_id = v_empresa
          AND os.deleted_at IS NULL
          AND public.os_status_mapear_legado(os.status::text) = 'em_reparo'
      )::INTEGER AS qtd_em_reparo,
      (SELECT COUNT(*) FROM public.ordens_de_servico os
        WHERE os.tecnico_responsavel_id = f.id
          AND os.empresa_id = v_empresa
          AND os.deleted_at IS NULL
          AND public.os_status_mapear_legado(os.status::text) = 'aguardando_peca'
      )::INTEGER AS qtd_aguardando_peca
    FROM public.funcionarios f
    WHERE f.empresa_id = v_empresa
      AND f.ativo = TRUE
  ) b;

  RETURN v_resultado;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_bancadas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_bancadas() TO authenticated;

COMMIT;