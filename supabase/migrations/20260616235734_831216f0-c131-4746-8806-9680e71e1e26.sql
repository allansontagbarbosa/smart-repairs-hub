-- 1) Portal: remover policy ampla e criar RPC restrita
DROP POLICY IF EXISTS "Portal client update own orders" ON public.ordens_de_servico;

CREATE OR REPLACE FUNCTION public.portal_responder_orcamento(
  p_os_id uuid,
  p_aprovado boolean,
  p_motivo text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ok boolean;
  v_status_antes text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'não autenticado');
  END IF;

  -- Bloqueia usuários internos: o portal é exclusivo do cliente
  IF public.is_internal_user(v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rota exclusiva do portal do cliente');
  END IF;

  -- A OS precisa pertencer ao cliente autenticado
  SELECT EXISTS (
    SELECT 1
    FROM public.ordens_de_servico o
    JOIN public.aparelhos a ON a.id = o.aparelho_id
    JOIN public.clientes  c ON c.id = a.cliente_id
    WHERE o.id = p_os_id AND c.user_id = v_uid
  ) INTO v_ok;

  IF NOT v_ok THEN
    RETURN jsonb_build_object('success', false, 'error', 'ordem não encontrada');
  END IF;

  SELECT status::text INTO v_status_antes FROM public.ordens_de_servico WHERE id = p_os_id;

  -- Só permite responder enquanto estiver aguardando aprovação
  IF v_status_antes <> 'aguardando_aprovacao' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ordem não está aguardando aprovação');
  END IF;

  IF p_aprovado THEN
    UPDATE public.ordens_de_servico
       SET status = 'aprovado'::status_ordem,
           aprovacao_orcamento = 'aprovado',
           data_aprovacao = now()
     WHERE id = p_os_id;
  ELSE
    UPDATE public.ordens_de_servico
       SET status = 'recebido'::status_ordem,
           aprovacao_orcamento = 'recusado',
           motivo_reprovacao = NULLIF(btrim(coalesce(p_motivo,'')),'')
     WHERE id = p_os_id;
  END IF;

  INSERT INTO public.historico_ordens (ordem_id, status_anterior, status_novo, descricao, observacao)
  VALUES (
    p_os_id,
    v_status_antes,
    CASE WHEN p_aprovado THEN 'aprovado' ELSE 'recebido' END,
    CASE WHEN p_aprovado THEN 'Orçamento aprovado pelo cliente via portal'
         ELSE 'Orçamento recusado pelo cliente via portal' END,
    CASE WHEN p_aprovado THEN NULL ELSE NULLIF(btrim(coalesce(p_motivo,'')),'') END
  );

  RETURN jsonb_build_object('success', true);
END; $$;

REVOKE ALL ON FUNCTION public.portal_responder_orcamento(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_responder_orcamento(uuid, boolean, text) TO authenticated;

-- 2) IA: restringir SELECT à própria conversa do usuário
DROP POLICY IF EXISTS ia_conversas_select ON public.ia_conversas;
CREATE POLICY ia_conversas_select ON public.ia_conversas FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id() AND usuario_id = auth.uid());