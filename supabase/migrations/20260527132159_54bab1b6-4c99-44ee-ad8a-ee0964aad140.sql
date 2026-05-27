CREATE OR REPLACE FUNCTION public.portal_lojas_do_grupo()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_grupo_id uuid;
  v_grupo_nome text;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id, nome INTO v_grupo_id, v_grupo_nome
    FROM lojista_grupos
   WHERE user_id = v_user_id
     AND ativo = true
     AND status_acesso = 'ativo'
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_grupo_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  WITH lojas AS (
    SELECT c.id, c.nome
      FROM clientes c
     WHERE c.grupo_id = v_grupo_id
       AND c.deleted_at IS NULL
  ),
  fat AS (
    SELECT a.cliente_id,
           COALESCE(SUM(os.valor_total) FILTER (WHERE os.status = 'entregue'), 0) AS faturado,
           COUNT(os.id) AS qtd_ordens
      FROM ordens_de_servico os
      JOIN aparelhos a ON a.id = os.aparelho_id
     WHERE a.cliente_id IN (SELECT id FROM lojas)
       AND os.deleted_at IS NULL
     GROUP BY a.cliente_id
  ),
  pag AS (
    SELECT p.cliente_id,
           COALESCE(SUM(p.valor), 0) AS pago
      FROM pagamentos_clientes p
     WHERE p.cliente_id IN (SELECT id FROM lojas)
       AND p.deleted_at IS NULL
     GROUP BY p.cliente_id
  )
  SELECT jsonb_build_object(
    'success',  true,
    'grupo_id', v_grupo_id,
    'grupo_nome', v_grupo_nome,
    'lojas', COALESCE(jsonb_agg(
      jsonb_build_object(
        'cliente_id',   l.id,
        'cliente_nome', l.nome,
        'nome',         l.nome,
        'faturado',     COALESCE(f.faturado, 0),
        'pago',         COALESCE(p.pago, 0),
        'devedor',      COALESCE(f.faturado, 0) - COALESCE(p.pago, 0),
        'qtd_os_total', COALESCE(f.qtd_ordens, 0),
        'qtd_ordens',   COALESCE(f.qtd_ordens, 0)
      ) ORDER BY l.nome ASC
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM lojas l
  LEFT JOIN fat f ON f.cliente_id = l.id
  LEFT JOIN pag p ON p.cliente_id = l.id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.portal_lojas_do_grupo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_lojas_do_grupo() TO authenticated;


CREATE OR REPLACE FUNCTION public.portal_detalhe_ordem(p_ordem_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_grupo_id uuid;
  v_cliente_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id INTO v_grupo_id
    FROM lojista_grupos
   WHERE user_id = v_user_id
     AND ativo = true
     AND status_acesso = 'ativo'
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_grupo_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT a.cliente_id INTO v_cliente_id
    FROM ordens_de_servico os
    JOIN aparelhos a ON a.id = os.aparelho_id
    JOIN clientes  c ON c.id = a.cliente_id
   WHERE os.id = p_ordem_id
     AND os.deleted_at IS NULL
     AND c.grupo_id = v_grupo_id
     AND c.deleted_at IS NULL
   LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'ordem', jsonb_build_object(
      'id',                os.id,
      'numero',            os.numero,
      'numero_formatado',  os.numero_formatado,
      'status',            os.status,
      'valor',             os.valor,
      'valor_total',       os.valor_total,
      'valor_pago',        os.valor_pago,
      'valor_pendente',    os.valor_pendente,
      'custo_pecas',       NULL,
      'data_entrada',      os.data_entrada,
      'data_entrega',      os.data_entrega,
      'data_conclusao',    os.data_conclusao,
      'previsao_entrega',  os.previsao_entrega,
      'defeito_relatado',  os.defeito_relatado,
      'diagnostico',       os.diagnostico,
      'servico_realizado', os.servico_realizado,
      'observacoes',       os.observacoes,
      'obs_cliente',       os.obs_cliente,
      'garantia_dias',     os.garantia_dias,
      'cliente',           jsonb_build_object('id', c.id, 'nome', c.nome),
      'cliente_id',        c.id,
      'cliente_nome',      c.nome,
      'aparelho', jsonb_build_object(
        'marca',      a.marca,
        'modelo',     a.modelo,
        'cor',        a.cor,
        'capacidade', a.capacidade,
        'imei',       a.imei,
        'imei2',      NULL,
        'estado_geral', NULL
      ),
      'data_aprovacao',      NULL,
      'aprovacao_orcamento', NULL,
      'motivo_reprovacao',   NULL,
      'prazo_vencido',       NULL,
      'timeline', jsonb_build_array(
        jsonb_build_object('evento', 'Entrada',    'data', os.data_entrada),
        jsonb_build_object('evento', 'Conclusão',  'data', os.data_conclusao),
        jsonb_build_object('evento', 'Entrega',    'data', os.data_entrega)
      ),
      'garantia', (
        SELECT jsonb_build_object(
          'id',             g.id,
          'data_inicio',    g.data_inicio,
          'data_fim',       g.data_fim,
          'dias_garantia',  g.dias_garantia,
          'dias_restantes', GREATEST(0, (g.data_fim - CURRENT_DATE)),
          'ativa',          (g.data_fim >= CURRENT_DATE AND g.status = 'ativa'),
          'status',         g.status,
          'observacoes',    g.observacoes
        )
          FROM garantias g
         WHERE g.ordem_id = os.id
         ORDER BY g.created_at DESC
         LIMIT 1
      )
    )
  )
  INTO v_result
  FROM ordens_de_servico os
  JOIN aparelhos a ON a.id = os.aparelho_id
  JOIN clientes  c ON c.id = a.cliente_id
  WHERE os.id = p_ordem_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.portal_detalhe_ordem(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_detalhe_ordem(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.portal_meu_perfil()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_grupo lojista_grupos%ROWTYPE;
  v_user_email text;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT * INTO v_grupo
    FROM lojista_grupos
   WHERE user_id = v_user_id
     AND ativo = true
     AND status_acesso = 'ativo'
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_grupo.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  WITH lojas AS (
    SELECT c.id, c.nome, c.email, c.telefone,
           NULLIF(TRIM(BOTH ' ,-' FROM
             COALESCE(c.rua,'')
             || CASE WHEN c.numero_endereco IS NOT NULL THEN ', '||c.numero_endereco ELSE '' END
             || CASE WHEN c.bairro IS NOT NULL THEN ', '||c.bairro ELSE '' END
             || CASE WHEN c.cidade IS NOT NULL THEN ', '||c.cidade ELSE '' END
             || CASE WHEN c.estado IS NOT NULL THEN ' - '||c.estado ELSE '' END
           ), '') AS endereco
      FROM clientes c
     WHERE c.grupo_id = v_grupo.id
       AND c.deleted_at IS NULL
  ),
  cnt_ap AS (
    SELECT a.cliente_id, COUNT(*) AS qtd
      FROM aparelhos a
     WHERE a.cliente_id IN (SELECT id FROM lojas)
     GROUP BY a.cliente_id
  ),
  cnt_os AS (
    SELECT a.cliente_id, COUNT(os.id) AS qtd
      FROM ordens_de_servico os
      JOIN aparelhos a ON a.id = os.aparelho_id
     WHERE a.cliente_id IN (SELECT id FROM lojas)
       AND os.deleted_at IS NULL
     GROUP BY a.cliente_id
  )
  SELECT jsonb_build_object(
    'success',    true,
    'user_email', v_user_email,
    'grupo', jsonb_build_object(
      'id',           v_grupo.id,
      'nome',         v_grupo.nome,
      'razao_social', v_grupo.razao_social,
      'cnpj_matriz',  v_grupo.cnpj_matriz,
      'email',        v_grupo.email,
      'telefone',     v_grupo.telefone,
      'responsavel',  v_grupo.responsavel,
      'observacoes',  v_grupo.observacoes
    ),
    'lojas', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',            l.id,
        'nome',          l.nome,
        'email',         l.email,
        'qtd_os',        COALESCE(o.qtd, 0),
        'qtd_aparelhos', COALESCE(ap.qtd, 0),
        'telefone',      l.telefone,
        'endereco',      l.endereco
      ) ORDER BY l.nome ASC
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM lojas l
  LEFT JOIN cnt_ap ap ON ap.cliente_id = l.id
  LEFT JOIN cnt_os o  ON o.cliente_id  = l.id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.portal_meu_perfil() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_meu_perfil() TO authenticated;