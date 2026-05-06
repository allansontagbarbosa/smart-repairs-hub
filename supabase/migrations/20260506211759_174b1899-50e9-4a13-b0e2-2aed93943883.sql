CREATE OR REPLACE FUNCTION public.kpi_tecnicos(
  p_inicio timestamptz, p_fim timestamptz, p_loja_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_empresa uuid; v_resultado jsonb; v_mi text; v_mf text;
BEGIN
  v_empresa := public.get_my_empresa_id();
  IF v_empresa IS NULL THEN RETURN jsonb_build_object('success',false,'error','Sem empresa'); END IF;
  v_mi := to_char(p_inicio,'YYYY-MM'); v_mf := to_char(p_fim,'YYYY-MM');

  WITH sp AS (
    SELECT s.id,s.ordem_id,s.tecnico_id,s.valor,s.iniciado_em,s.concluido_em,o.valor_total,o.loja_id
    FROM os_servicos s JOIN ordens_de_servico o ON o.id=s.ordem_id
    WHERE s.empresa_id=v_empresa AND s.tecnico_id IS NOT NULL AND o.deleted_at IS NULL
      AND s.status='concluido' AND s.concluido_em BETWEEN p_inicio AND p_fim
      AND (p_loja_id IS NULL OR o.loja_id=p_loja_id)
  ),
  ou AS (SELECT DISTINCT tecnico_id,ordem_id,valor_total FROM sp),
  sa AS (
    SELECT tecnico_id,COUNT(*) qs,COUNT(DISTINCT ordem_id) qos,COALESCE(SUM(valor),0) vs,
      AVG(EXTRACT(EPOCH FROM(concluido_em-iniciado_em))/3600.0)
        FILTER(WHERE iniciado_em IS NOT NULL AND concluido_em IS NOT NULL) tmh
    FROM sp GROUP BY tecnico_id
  ),
  fa AS (SELECT tecnico_id,COALESCE(SUM(valor_total),0) fat FROM ou GROUP BY tecnico_id),
  cp AS (
    SELECT c.funcionario_id,c.status,c.valor FROM comissoes c
    JOIN os_servicos s ON s.id=c.os_servico_id JOIN ordens_de_servico o ON o.id=s.ordem_id
    WHERE c.empresa_id=v_empresa AND c.estornada_em IS NULL AND c.status IN('pendente','liberada')
      AND s.concluido_em BETWEEN p_inicio AND p_fim
      AND (p_loja_id IS NULL OR o.loja_id=p_loja_id)
    UNION ALL
    SELECT c.funcionario_id,c.status,c.valor FROM comissoes c
    WHERE c.empresa_id=v_empresa AND c.estornada_em IS NULL AND c.status IN('pendente','liberada')
      AND c.os_servico_id IS NULL AND c.mes_competencia BETWEEN v_mi AND v_mf
      AND p_loja_id IS NULL
    UNION ALL
    SELECT c.funcionario_id,c.status,c.valor FROM comissoes c
    LEFT JOIN os_servicos s ON s.id=c.os_servico_id
    LEFT JOIN ordens_de_servico o ON o.id=s.ordem_id
    WHERE c.empresa_id=v_empresa AND c.estornada_em IS NULL AND c.status='paga'
      AND c.data_pagamento IS NOT NULL AND c.data_pagamento BETWEEN p_inicio AND p_fim
      AND (p_loja_id IS NULL OR o.loja_id=p_loja_id OR c.os_servico_id IS NULL)
  ),
  ca AS (
    SELECT funcionario_id,
      COALESCE(SUM(CASE WHEN status='pendente' THEN valor ELSE 0 END),0) cp,
      COALESCE(SUM(CASE WHEN status='liberada' THEN valor ELSE 0 END),0) cl,
      COALESCE(SUM(CASE WHEN status='paga' THEN valor ELSE 0 END),0) cpg
    FROM cp GROUP BY funcionario_id
  ),
  tv AS (
    SELECT DISTINCT up.funcionario_id id FROM user_profiles up
    JOIN perfis_acesso pa ON pa.id=up.perfil_id
    WHERE up.empresa_id=v_empresa AND up.funcionario_id IS NOT NULL
      AND lower(unaccent(pa.nome_perfil)) LIKE '%tecnico%'
    UNION SELECT DISTINCT tecnico_id FROM os_servicos
    WHERE empresa_id=v_empresa AND tecnico_id IS NOT NULL
  )
  SELECT jsonb_agg(jsonb_build_object(
    'funcionario_id',f.id,'nome',f.nome,
    'qtd_servicos',COALESCE(sa.qs,0),'qtd_os',COALESCE(sa.qos,0),
    'valor_servicos',COALESCE(sa.vs,0),'faturamento_os',COALESCE(fa.fat,0),
    'tempo_medio_horas',COALESCE(sa.tmh,0),
    'comissao_pendente',COALESCE(ca.cp,0),'comissao_liberada',COALESCE(ca.cl,0),
    'comissao_paga',COALESCE(ca.cpg,0),
    'comissao_total_a_receber',COALESCE(ca.cp,0)+COALESCE(ca.cl,0),
    'ticket_medio_os',CASE WHEN COALESCE(sa.qos,0)>0 THEN COALESCE(fa.fat,0)/sa.qos ELSE 0 END
  ) ORDER BY (COALESCE(ca.cp,0)+COALESCE(ca.cl,0)) DESC,COALESCE(sa.qs,0) DESC)
  INTO v_resultado
  FROM funcionarios f JOIN tv ON tv.id=f.id
  LEFT JOIN sa ON sa.tecnico_id=f.id LEFT JOIN fa ON fa.tecnico_id=f.id
  LEFT JOIN ca ON ca.funcionario_id=f.id
  WHERE f.empresa_id=v_empresa AND f.deleted_at IS NULL AND f.ativo=true;

  RETURN jsonb_build_object('success',true,'tecnicos',COALESCE(v_resultado,'[]'::jsonb));
END; $$;

DROP FUNCTION IF EXISTS public.kpi_tecnicos(timestamptz,timestamptz);
GRANT EXECUTE ON FUNCTION public.kpi_tecnicos(timestamptz,timestamptz,uuid) TO authenticated;