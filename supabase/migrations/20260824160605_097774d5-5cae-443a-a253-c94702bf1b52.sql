-- 1) Trigger de agregação: OS não aprovada é encerrada, não muda mais de status
CREATE OR REPLACE FUNCTION public.agregar_status_os()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ordem_id uuid;
  v_status_os text;
  v_total int;
  v_concluidos int;
  v_em_reparo int;
  v_pendentes int;
BEGIN
  v_ordem_id := COALESCE(NEW.ordem_id, OLD.ordem_id);

  SELECT status::text INTO v_status_os
  FROM public.ordens_de_servico WHERE id = v_ordem_id;

  IF v_status_os IS NULL OR v_status_os IN ('entregue', 'cancelado', 'nao_aprovado') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status::text = 'concluido'),
    COUNT(*) FILTER (WHERE status::text = 'em_reparo'),
    COUNT(*) FILTER (WHERE status::text = 'pendente')
  INTO v_total, v_concluidos, v_em_reparo, v_pendentes
  FROM public.os_servicos
  WHERE ordem_id = v_ordem_id;

  IF v_total = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_total = v_concluidos THEN
    UPDATE public.ordens_de_servico
    SET status = 'pronto'
    WHERE id = v_ordem_id
      AND status::text NOT IN ('pronto', 'entregue', 'cancelado', 'nao_aprovado');
  ELSIF v_em_reparo > 0 THEN
    UPDATE public.ordens_de_servico
    SET status = 'em_reparo'
    WHERE id = v_ordem_id
      AND status::text NOT IN ('pronto', 'entregue', 'cancelado', 'nao_aprovado');
  ELSIF v_total = v_pendentes THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2) Permite Atendimento/Técnico marcar como não aprovado; bloqueia reabertura de OS encerrada
CREATE OR REPLACE FUNCTION public.atualizar_status_os(p_os_id uuid, p_novo_status text, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id    UUID := auth.uid();
  v_empresa_id UUID := public.get_my_empresa_id();
  v_role       TEXT := public.get_my_role();
  v_funcionario_id UUID;
  v_os_funcionario UUID;
  v_status_atual TEXT;
  v_admin_roles TEXT[] := ARRAY['Administrador','Gerente','Financeiro'];
  v_atendimento_status TEXT[] := ARRAY['recebido','aprovado','entregue','cancelado','nao_aprovado'];
  v_tecnico_status     TEXT[] := ARRAY['em_analise','aguardando_aprovacao','em_reparo','aguardando_peca','pronto','nao_aprovado'];
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário sem empresa vinculada');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'status_ordem' AND e.enumlabel = p_novo_status
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', format('Status inválido: %s', p_novo_status));
  END IF;

  SELECT status::text, funcionario_id
    INTO v_status_atual, v_os_funcionario
  FROM public.ordens_de_servico
  WHERE id = p_os_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;

  IF v_status_atual IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS não encontrada');
  END IF;
  IF v_status_atual = p_novo_status THEN
    RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('os_id', p_os_id, 'status', p_novo_status, 'noop', true));
  END IF;

  -- OS não aprovada está encerrada: só administradores podem reabrir
  IF v_status_atual = 'nao_aprovado' AND NOT (v_role = ANY (v_admin_roles)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS encerrada por não aprovação. Apenas administradores podem reabrir.');
  END IF;

  SELECT funcionario_id INTO v_funcionario_id
  FROM public.user_profiles
  WHERE (user_id = v_user_id OR id = v_user_id) AND ativo = true
  LIMIT 1;

  IF v_role = ANY (v_admin_roles) THEN
    NULL;
  ELSIF v_role = 'Atendimento' THEN
    IF NOT (p_novo_status = ANY (v_atendimento_status)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Atendimento não pode mover para esse status');
    END IF;
  ELSIF v_role = 'Técnico' THEN
    IF v_funcionario_id IS NULL OR v_os_funcionario IS NULL OR v_os_funcionario <> v_funcionario_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Técnico só pode mover OS atribuída a ele');
    END IF;
    IF NOT (p_novo_status = ANY (v_tecnico_status)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Técnico não pode mover para esse status');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Perfil sem permissão');
  END IF;

  UPDATE public.ordens_de_servico
  SET status     = p_novo_status::status_ordem,
      updated_at = now()
  WHERE id = p_os_id;

  IF p_observacao IS NOT NULL THEN
    UPDATE public.os_status_historico
    SET observacao = p_observacao
    WHERE id = (
      SELECT id FROM public.os_status_historico
      WHERE os_id = p_os_id ORDER BY mudado_em DESC LIMIT 1
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object('os_id', p_os_id, 'status_anterior', v_status_atual, 'status_novo', p_novo_status)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- 3) Reprovação no portal do cliente encerra a OS como "não aprovado"
CREATE OR REPLACE FUNCTION public.portal_reprovar_orcamento(p_os_id uuid, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cli RECORD;
  v_os RECORD;
BEGIN
  SELECT * INTO v_cli FROM public.get_my_cliente_lojista();
  IF v_cli.cliente_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso não autorizado');
  END IF;

  SELECT os.* INTO v_os
  FROM public.ordens_de_servico os
  JOIN public.aparelhos a ON a.id = os.aparelho_id
  WHERE os.id = p_os_id
    AND a.cliente_id = v_cli.cliente_id
    AND os.empresa_id = v_cli.empresa_id
    AND os.deleted_at IS NULL;

  IF v_os.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS não encontrada');
  END IF;
  IF v_os.orcamento_reprovado_em IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Já estava reprovado');
  END IF;
  IF v_os.orcamento_aprovado_em IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orçamento já foi aprovado');
  END IF;
  IF v_os.status IN ('entregue','cancelado','nao_aprovado') THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS já finalizada');
  END IF;

  UPDATE public.ordens_de_servico
    SET orcamento_reprovado_em = NOW(),
        orcamento_motivo_reprovacao = NULLIF(TRIM(p_motivo), ''),
        orcamento_decidido_por_user = auth.uid(),
        status = 'nao_aprovado'::status_ordem,
        updated_at = NOW()
    WHERE id = p_os_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;