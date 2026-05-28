CREATE TABLE IF NOT EXISTS public.notificacoes_tecnico (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo           text NOT NULL,
  titulo         text NOT NULL,
  mensagem       text NOT NULL,
  link_interno   text,
  ref_id         uuid,
  lida           boolean NOT NULL DEFAULT false,
  lida_em        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes_tecnico TO authenticated;
GRANT ALL ON public.notificacoes_tecnico TO service_role;

ALTER TABLE public.notificacoes_tecnico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tecnico_ve_propria_notificacao" ON public.notificacoes_tecnico;
CREATE POLICY "tecnico_ve_propria_notificacao" ON public.notificacoes_tecnico
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notif_tec_user_lida
  ON public.notificacoes_tecnico(user_id, lida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_tec_func
  ON public.notificacoes_tecnico(funcionario_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_notificacoes_tecnico(p_apenas_nao_lidas boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_lista jsonb;
  v_nao_lidas int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  SELECT COUNT(*) INTO v_nao_lidas FROM notificacoes_tecnico
   WHERE user_id = v_user_id AND lida = false;
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id, 'tipo', tipo, 'titulo', titulo, 'mensagem', mensagem,
      'link_interno', link_interno, 'ref_id', ref_id, 'lida', lida,
      'created_at', created_at
    ) ORDER BY created_at DESC
  ), '[]'::jsonb)
  INTO v_lista
  FROM notificacoes_tecnico
  WHERE user_id = v_user_id
    AND (p_apenas_nao_lidas = false OR lida = false)
  LIMIT 50;
  RETURN jsonb_build_object('success', true, 'nao_lidas', v_nao_lidas, 'notificacoes', v_lista);
END;
$$;
REVOKE ALL ON FUNCTION public.get_notificacoes_tecnico(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_notificacoes_tecnico(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.marcar_notificacao_tecnico_lida(p_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  IF p_id IS NULL THEN
    UPDATE notificacoes_tecnico SET lida = true, lida_em = now()
     WHERE user_id = v_user_id AND lida = false;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    UPDATE notificacoes_tecnico SET lida = true, lida_em = now()
     WHERE id = p_id AND user_id = v_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  RETURN jsonb_build_object('success', true, 'marcadas', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.marcar_notificacao_tecnico_lida(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_notificacao_tecnico_lida(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._notificar_atribuicao_tecnico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tecnico_user_id uuid;
  v_tecnico_func    record;
  v_ordem           record;
  v_atribuidor_nome text;
  v_servico_nome    text;
BEGIN
  IF NEW.tecnico_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.tecnico_id IS NOT DISTINCT FROM OLD.tecnico_id THEN RETURN NEW; END IF;
  IF NEW.status = 'em_reparo' AND OLD.tecnico_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT f.nome, f.empresa_id
    INTO v_tecnico_func
    FROM funcionarios f
   WHERE f.id = NEW.tecnico_id;
  IF v_tecnico_func IS NULL THEN RETURN NEW; END IF;

  SELECT up.user_id INTO v_tecnico_user_id
    FROM user_profiles up
   WHERE up.funcionario_id = NEW.tecnico_id
     AND up.ativo = true
   LIMIT 1;
  IF v_tecnico_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT os.numero, os.numero_formatado
    INTO v_ordem
    FROM ordens_de_servico os
   WHERE os.id = NEW.ordem_id;

  SELECT COALESCE(
    (SELECT s.nome FROM socios s WHERE s.user_id = auth.uid() AND s.ativo = true LIMIT 1),
    (SELECT f.nome FROM funcionarios f
       JOIN user_profiles up ON up.funcionario_id = f.id
      WHERE up.user_id = auth.uid() AND up.ativo = true LIMIT 1),
    'Admin'
  ) INTO v_atribuidor_nome;

  v_servico_nome := COALESCE(NEW.nome, 'Serviço');

  INSERT INTO notificacoes_tecnico (
    empresa_id, funcionario_id, user_id, tipo, titulo, mensagem, ref_id, link_interno
  ) VALUES (
    v_tecnico_func.empresa_id,
    NEW.tecnico_id,
    v_tecnico_user_id,
    'servico_atribuido',
    'Novo serviço pra você',
    v_atribuidor_nome || ' te atribuiu o serviço "' || v_servico_nome
      || '" da OS-' || COALESCE(v_ordem.numero_formatado, lpad(v_ordem.numero::text, 6, '0')),
    NEW.id,
    '/tecnico/ordens'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_atribuicao_tecnico ON public.os_servicos;
CREATE TRIGGER trg_notificar_atribuicao_tecnico
  AFTER UPDATE OF tecnico_id ON public.os_servicos
  FOR EACH ROW
  EXECUTE FUNCTION public._notificar_atribuicao_tecnico();