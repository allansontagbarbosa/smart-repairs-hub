CREATE OR REPLACE FUNCTION public.atualizar_meu_perfil(p_nome text, p_whatsapp text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_func uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'nao autenticado');
  END IF;

  UPDATE public.user_profiles
     SET nome_exibicao = COALESCE(NULLIF(p_nome, ''), nome_exibicao),
         updated_at    = now()
   WHERE user_id = v_uid
   RETURNING funcionario_id INTO v_func;

  -- WhatsApp/telefone: salvar no funcionario vinculado, se houver
  IF v_func IS NOT NULL AND p_whatsapp IS NOT NULL THEN
    UPDATE public.funcionarios
       SET telefone = p_whatsapp
     WHERE id = v_func;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.atualizar_meu_perfil(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_meu_perfil(text, text) TO authenticated;