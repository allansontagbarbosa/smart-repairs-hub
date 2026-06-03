
-- 1) Aprovação: somente o sócio destinatário (s.user_id = auth.uid()) aprova
CREATE OR REPLACE FUNCTION public.socio_retirada_aprovar(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_emp  uuid := public.get_my_empresa_id();
  v_r record;
  v_dest_user uuid;
  v_saldo numeric;
BEGIN
  IF v_user IS NULL OR v_emp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT r.*, s.user_id AS dest_user_id
    INTO v_r
    FROM public.retiradas_socios r
    JOIN public.socios s ON s.id = r.socio_id
   WHERE r.id = p_id AND r.empresa_id = v_emp
   FOR UPDATE OF r;

  IF v_r.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retirada não encontrada');
  END IF;
  IF v_r.status <> 'pendente' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retirada não está pendente');
  END IF;
  v_dest_user := v_r.dest_user_id;
  IF v_dest_user IS NULL OR v_dest_user <> v_user THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Apenas o sócio destinatário pode aprovar a própria retirada');
  END IF;

  SELECT COALESCE(SUM(valor), 0) INTO v_saldo
    FROM public.extrato_socio WHERE socio_id = v_r.socio_id;
  IF v_r.valor > v_saldo THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Saldo insuficiente. Disponível: R$ ' || to_char(v_saldo, 'FM999G999G990D00'));
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
$function$;

-- 2) Listagem: pode_aprovar = sócio destinatário
DROP FUNCTION IF EXISTS public.socio_retiradas_listar();
CREATE OR REPLACE FUNCTION public.socio_retiradas_listar()
RETURNS TABLE(
  id uuid, socio_id uuid, socio_user_id uuid, socio_nome text,
  valor numeric, descricao text, status text, data_retirada date,
  criado_por uuid, criado_em timestamp with time zone,
  aprovado_por uuid, aprovado_em timestamp with time zone,
  motivo_rejeicao text, motivo_cancelamento text,
  pode_aprovar boolean, pode_cancelar boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT r.id, r.socio_id, s.user_id, s.nome, r.valor,
         r.descricao, r.status, r.data_retirada,
         r.criado_por, r.created_at,
         r.aprovado_por, r.aprovado_em,
         r.motivo_rejeicao, r.motivo_cancelamento,
         (r.status='pendente' AND s.user_id = auth.uid()) AS pode_aprovar,
         (r.status='pendente' AND r.criado_por = auth.uid()) AS pode_cancelar
    FROM public.retiradas_socios r
    JOIN public.socios s ON s.id = r.socio_id
   WHERE r.empresa_id = public.get_my_empresa_id()
     AND public.is_adm_ou_socio()
   ORDER BY r.created_at DESC;
$function$;

-- 3) Visão administrativa: lista todos os sócios consolidados
CREATE OR REPLACE FUNCTION public.socios_visao_admin()
RETURNS TABLE(
  socio_id uuid,
  user_id uuid,
  nome text,
  percentual numeric,
  total_creditado numeric,
  total_retirado numeric,
  saldo numeric,
  retiradas_pendentes numeric,
  qtd_pendentes integer,
  eh_voce boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_emp  uuid := public.get_my_empresa_id();
BEGIN
  IF v_user IS NULL OR v_emp IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT public.is_adm_ou_socio() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.nome,
    COALESCE(s.percentual_participacao, 0)::numeric,
    COALESCE((SELECT SUM(valor) FROM public.extrato_socio e
              WHERE e.socio_id = s.id AND e.valor > 0), 0)::numeric AS total_creditado,
    COALESCE((SELECT SUM(-valor) FROM public.extrato_socio e
              WHERE e.socio_id = s.id AND e.tipo = 'debito_retirada'), 0)::numeric AS total_retirado,
    COALESCE((SELECT SUM(valor) FROM public.extrato_socio e
              WHERE e.socio_id = s.id), 0)::numeric AS saldo,
    COALESCE((SELECT SUM(valor) FROM public.retiradas_socios r
              WHERE r.socio_id = s.id AND r.status = 'pendente'), 0)::numeric AS retiradas_pendentes,
    COALESCE((SELECT COUNT(*)::int FROM public.retiradas_socios r
              WHERE r.socio_id = s.id AND r.status = 'pendente'), 0) AS qtd_pendentes,
    (s.user_id = v_user) AS eh_voce
  FROM public.socios s
  WHERE s.empresa_id = v_emp
    AND COALESCE(s.ativo, true)
    AND s.deleted_at IS NULL
  ORDER BY COALESCE(s.percentual_participacao, 0) DESC, s.nome;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.socios_visao_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.socio_retiradas_listar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.socio_retirada_aprovar(uuid) TO authenticated;
