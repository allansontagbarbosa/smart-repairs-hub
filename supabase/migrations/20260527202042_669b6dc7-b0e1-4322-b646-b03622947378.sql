CREATE OR REPLACE FUNCTION public.cancelar_retirada(
  p_retirada_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_socio_id  uuid;
  v_retirada  record;
  v_mesmo_dia boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id INTO v_socio_id FROM socios
   WHERE user_id = v_user_id AND ativo = true AND deleted_at IS NULL LIMIT 1;
  IF v_socio_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não é sócio');
  END IF;

  SELECT * INTO v_retirada FROM retiradas_socios WHERE id = p_retirada_id;
  IF v_retirada.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retirada não encontrada');
  END IF;
  IF v_retirada.socio_id <> v_socio_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Só o próprio sócio pode cancelar sua retirada');
  END IF;
  IF v_retirada.status = 'cancelada' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retirada já está cancelada');
  END IF;

  v_mesmo_dia := (v_retirada.created_at::date = CURRENT_DATE);

  IF v_mesmo_dia THEN
    DELETE FROM extrato_socio WHERE retirada_id = p_retirada_id;
    DELETE FROM retiradas_socios WHERE id = p_retirada_id;

    RETURN jsonb_build_object(
      'success', true,
      'retirada_id', p_retirada_id,
      'modo', 'apagada_mesmo_dia',
      'mensagem', 'Retirada apagada sem deixar rastro (feita hoje)'
    );
  ELSE
    UPDATE retiradas_socios SET
      status = 'cancelada',
      cancelado_por = v_user_id,
      cancelado_em = now(),
      motivo_cancelamento = p_motivo,
      updated_at = now()
    WHERE id = p_retirada_id;

    INSERT INTO extrato_socio (
      empresa_id, socio_id, tipo, valor, descricao, retirada_id, criado_por
    ) VALUES (
      v_retirada.empresa_id, v_retirada.socio_id, 'estorno_retirada', v_retirada.valor,
      'Estorno da retirada · ' || COALESCE(p_motivo, 'sem motivo'),
      p_retirada_id, v_user_id
    );

    RETURN jsonb_build_object(
      'success', true,
      'retirada_id', p_retirada_id,
      'modo', 'estornada',
      'mensagem', 'Retirada estornada (visível no extrato)'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_retirada(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_retirada(uuid, text) TO authenticated;

DO $$
DECLARE
  v_retirada_id uuid := '73162cc9-4619-430e-9f63-3bf6e9a4c175';
  v_existe boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM retiradas_socios WHERE id = v_retirada_id) INTO v_existe;
  IF v_existe THEN
    DELETE FROM extrato_socio WHERE retirada_id = v_retirada_id;
    DELETE FROM retiradas_socios WHERE id = v_retirada_id;
    RAISE NOTICE 'Limpeza one-shot: apagada retirada de teste e suas movimentações';
  ELSE
    RAISE NOTICE 'Limpeza one-shot: retirada de teste já não existe (ok)';
  END IF;
END $$;