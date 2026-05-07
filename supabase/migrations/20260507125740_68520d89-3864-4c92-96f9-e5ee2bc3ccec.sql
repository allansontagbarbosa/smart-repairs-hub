CREATE OR REPLACE FUNCTION admin.listar_empresas(p_status text DEFAULT NULL, p_busca text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = admin, public AS $$
DECLARE v_resultado jsonb;
BEGIN
  IF NOT admin.is_staff() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'empresa_id', emp.id,
    'nome', emp.nome,
    'criada_em', emp.criado_em,
    'assinatura_id', a.id,
    'plano_tier', p.tier,
    'plano_nome', p.nome,
    'status', a.status,
    'mrr_centavos', a.mrr_centavos,
    'trial_termina_em', a.trial_termina_em,
    'ativada_em', a.ativada_em,
    'cancelada_em', a.cancelada_em,
    'email_principal', (
      SELECT u.email FROM auth.users u
      JOIN public.user_profiles up ON up.user_id = u.id
      WHERE up.empresa_id = emp.id LIMIT 1
    )
  ) ORDER BY a.mrr_centavos DESC NULLS LAST, emp.criado_em DESC) INTO v_resultado
  FROM public.empresas emp
  LEFT JOIN admin.assinaturas a ON a.empresa_id = emp.id
  LEFT JOIN admin.planos p ON p.id = a.plano_id
  WHERE (p_status IS NULL OR a.status::text = p_status)
    AND (p_busca IS NULL OR emp.nome ILIKE '%' || p_busca || '%');

  RETURN jsonb_build_object('success', true, 'empresas', COALESCE(v_resultado, '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION admin.listar_empresas(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION admin.detalhe_empresa(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = admin, public AS $$
DECLARE
  v_emp record; v_a record; v_p record;
  v_kpis_uso jsonb; v_eventos jsonb; v_notas jsonb;
BEGIN
  IF NOT admin.is_staff() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  SELECT id, nome, criado_em INTO v_emp FROM public.empresas WHERE id = p_empresa_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Empresa não encontrada'); END IF;

  SELECT * INTO v_a FROM admin.assinaturas WHERE empresa_id = p_empresa_id ORDER BY created_at DESC LIMIT 1;
  IF v_a.plano_id IS NOT NULL THEN
    SELECT * INTO v_p FROM admin.planos WHERE id = v_a.plano_id;
  END IF;

  SELECT jsonb_build_object(
    'qtd_oss_total', (SELECT COUNT(*) FROM public.ordens_de_servico WHERE empresa_id = p_empresa_id AND deleted_at IS NULL),
    'qtd_oss_30d', (SELECT COUNT(*) FROM public.ordens_de_servico WHERE empresa_id = p_empresa_id AND deleted_at IS NULL AND created_at >= now() - interval '30 days'),
    'qtd_funcionarios', (SELECT COUNT(*) FROM public.funcionarios WHERE empresa_id = p_empresa_id AND ativo = true),
    'qtd_usuarios', (SELECT COUNT(*) FROM public.user_profiles WHERE empresa_id = p_empresa_id),
    'ultima_atividade', (SELECT MAX(created_at) FROM public.ordens_de_servico WHERE empresa_id = p_empresa_id)
  ) INTO v_kpis_uso;

  SELECT jsonb_agg(jsonb_build_object(
    'tipo', e.tipo, 'valor_centavos', e.valor_centavos, 'payload', e.payload, 'criado_em', e.criado_em
  ) ORDER BY e.criado_em DESC) INTO v_eventos
  FROM admin.eventos_billing e WHERE e.empresa_id = p_empresa_id;

  SELECT jsonb_agg(jsonb_build_object(
    'id', n.id, 'texto', n.texto, 'criado_em', n.criado_em, 'autor_nome', u.nome
  ) ORDER BY n.criado_em DESC) INTO v_notas
  FROM admin.notas_cliente n LEFT JOIN admin.usuarios_internos u ON u.id = n.autor_id
  WHERE n.empresa_id = p_empresa_id;

  RETURN jsonb_build_object(
    'success', true,
    'empresa', jsonb_build_object('id', v_emp.id, 'nome', v_emp.nome, 'criada_em', v_emp.criado_em),
    'assinatura', CASE WHEN v_a.id IS NOT NULL THEN to_jsonb(v_a) ELSE NULL END,
    'plano', CASE WHEN v_p.id IS NOT NULL THEN to_jsonb(v_p) ELSE NULL END,
    'kpis_uso', v_kpis_uso,
    'eventos_billing', COALESCE(v_eventos, '[]'::jsonb),
    'notas', COALESCE(v_notas, '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION admin.detalhe_empresa(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION admin.criar_nota(p_empresa_id uuid, p_texto text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = admin AS $$
DECLARE v_autor uuid;
BEGIN
  IF NOT admin.is_staff() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;
  SELECT id INTO v_autor FROM admin.usuarios_internos WHERE user_id = auth.uid();
  INSERT INTO admin.notas_cliente (empresa_id, autor_id, texto) VALUES (p_empresa_id, v_autor, p_texto);
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION admin.criar_nota(uuid, text) TO authenticated;