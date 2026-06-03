
-- 1) Schema: novos campos + status estendido
ALTER TABLE public.retiradas_socios
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text;

ALTER TABLE public.retiradas_socios DROP CONSTRAINT IF EXISTS retiradas_socios_status_check;
ALTER TABLE public.retiradas_socios
  ADD CONSTRAINT retiradas_socios_status_check
  CHECK (status IN ('pendente','aprovada','rejeitada','cancelada','efetivada'));

-- 2) Helpers de papel
CREATE OR REPLACE FUNCTION public.is_socio()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.socios s
    WHERE s.user_id = auth.uid()
      AND s.empresa_id = public.get_my_empresa_id()
      AND coalesce(s.ativo, true)
      AND s.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_adm_ou_socio()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.eh_admin() OR public.is_socio();
$$;

-- 3) RLS: incluir ADM no SELECT (antes só sócio enxergava)
DROP POLICY IF EXISTS socio_ve_propria_empresa_retiradas ON public.retiradas_socios;
CREATE POLICY retiradas_visiveis ON public.retiradas_socios
  FOR SELECT
  USING (
    empresa_id = public.get_my_empresa_id()
    AND public.is_adm_ou_socio()
  );
-- tenant_isolation (ALL) já existe e cobre DML; RPCs SECURITY DEFINER fazem as travas.

-- 4) RPC: solicitar (cria pendente)
CREATE OR REPLACE FUNCTION public.socio_retirada_solicitar(
  p_socio_id uuid,
  p_valor numeric,
  p_descricao text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_emp  uuid := public.get_my_empresa_id();
  v_socio record;
  v_id uuid;
BEGIN
  IF v_user IS NULL OR v_emp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  IF NOT public.is_adm_ou_socio() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor inválido');
  END IF;
  SELECT * INTO v_socio FROM public.socios
    WHERE id = p_socio_id AND empresa_id = v_emp
      AND coalesce(ativo, true) AND deleted_at IS NULL;
  IF v_socio.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sócio destinatário inválido');
  END IF;
  INSERT INTO public.retiradas_socios (
    empresa_id, socio_id, valor, data_retirada, forma_pagamento,
    descricao, status, criado_por
  ) VALUES (
    v_emp, p_socio_id, p_valor, CURRENT_DATE, 'PIX',
    p_descricao, 'pendente', v_user
  ) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success', true, 'retirada_id', v_id);
END;
$$;

-- 5) RPC: aprovar (só sócio, criador ≠ aprovador, só pendente; lança no extrato)
CREATE OR REPLACE FUNCTION public.socio_retirada_aprovar(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_emp  uuid := public.get_my_empresa_id();
  v_r record;
  v_saldo numeric;
BEGIN
  IF v_user IS NULL OR v_emp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  IF NOT public.is_socio() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas sócios podem aprovar');
  END IF;
  SELECT * INTO v_r FROM public.retiradas_socios
    WHERE id = p_id AND empresa_id = v_emp FOR UPDATE;
  IF v_r.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retirada não encontrada');
  END IF;
  IF v_r.status <> 'pendente' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retirada não está pendente');
  END IF;
  IF v_r.criado_por = v_user THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não pode aprovar a própria retirada');
  END IF;
  SELECT COALESCE(SUM(valor), 0) INTO v_saldo
    FROM public.extrato_socio WHERE socio_id = v_r.socio_id;
  IF v_r.valor > v_saldo THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Saldo insuficiente do sócio destinatário. Disponível: R$ ' || to_char(v_saldo, 'FM999G999G990D00'));
  END IF;
  UPDATE public.retiradas_socios
    SET status='aprovada', aprovado_por=v_user, aprovado_em=now(), updated_at=now()
    WHERE id = p_id;
  INSERT INTO public.extrato_socio (
    empresa_id, socio_id, tipo, valor, descricao, data_movimento, retirada_id, criado_por
  ) VALUES (
    v_emp, v_r.socio_id, 'debito_retirada', -v_r.valor,
    COALESCE(v_r.descricao, 'Retirada via PIX (aprovada)'),
    v_r.data_retirada, v_r.id, v_user
  );
  RETURN jsonb_build_object('success', true, 'retirada_id', v_r.id);
END;
$$;

-- 6) RPC: rejeitar
CREATE OR REPLACE FUNCTION public.socio_retirada_rejeitar(p_id uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_emp  uuid := public.get_my_empresa_id();
  v_r record;
BEGIN
  IF v_user IS NULL OR v_emp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  IF NOT public.is_socio() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas sócios podem rejeitar');
  END IF;
  SELECT * INTO v_r FROM public.retiradas_socios
    WHERE id = p_id AND empresa_id = v_emp FOR UPDATE;
  IF v_r.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retirada não encontrada');
  END IF;
  IF v_r.status <> 'pendente' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retirada não está pendente');
  END IF;
  IF v_r.criado_por = v_user THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não pode decidir sobre a própria retirada');
  END IF;
  UPDATE public.retiradas_socios
    SET status='rejeitada', aprovado_por=v_user, aprovado_em=now(),
        motivo_rejeicao=p_motivo, updated_at=now()
    WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 7) RPC: cancelar (só criador, enquanto pendente)
CREATE OR REPLACE FUNCTION public.socio_retirada_cancelar(p_id uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_emp  uuid := public.get_my_empresa_id();
  v_r record;
BEGIN
  IF v_user IS NULL OR v_emp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  IF NOT public.is_adm_ou_socio() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;
  SELECT * INTO v_r FROM public.retiradas_socios
    WHERE id = p_id AND empresa_id = v_emp FOR UPDATE;
  IF v_r.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retirada não encontrada');
  END IF;
  IF v_r.status <> 'pendente' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas retiradas pendentes podem ser canceladas');
  END IF;
  IF v_r.criado_por <> v_user THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o criador pode cancelar');
  END IF;
  UPDATE public.retiradas_socios
    SET status='cancelada', cancelado_por=v_user, cancelado_em=now(),
        motivo_cancelamento=p_motivo, updated_at=now()
    WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- 8) Listagem com nomes (visível a ADM e sócios da empresa)
CREATE OR REPLACE FUNCTION public.socio_retiradas_listar()
RETURNS TABLE (
  id uuid, socio_id uuid, socio_nome text, valor numeric,
  descricao text, status text, data_retirada date,
  criado_por uuid, criado_em timestamptz,
  aprovado_por uuid, aprovado_em timestamptz,
  motivo_rejeicao text, motivo_cancelamento text,
  pode_aprovar boolean, pode_cancelar boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT r.id, r.socio_id, s.nome, r.valor,
         r.descricao, r.status, r.data_retirada,
         r.criado_por, r.created_at,
         r.aprovado_por, r.aprovado_em,
         r.motivo_rejeicao, r.motivo_cancelamento,
         (r.status='pendente' AND public.is_socio() AND r.criado_por <> auth.uid()) AS pode_aprovar,
         (r.status='pendente' AND r.criado_por = auth.uid()) AS pode_cancelar
    FROM public.retiradas_socios r
    JOIN public.socios s ON s.id = r.socio_id
   WHERE r.empresa_id = public.get_my_empresa_id()
     AND public.is_adm_ou_socio()
   ORDER BY r.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.is_socio() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_adm_ou_socio() TO authenticated;
GRANT EXECUTE ON FUNCTION public.socio_retirada_solicitar(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.socio_retirada_aprovar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.socio_retirada_rejeitar(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.socio_retirada_cancelar(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.socio_retiradas_listar() TO authenticated;
