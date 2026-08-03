DO $mig$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='trg_gerar_prejuizo_retrabalho';
  EXECUTE replace(d,
    E'\'automatico_garantia\', NEW.updated_by, NEW.updated_by',
    E'\'automatico_garantia\', NULLIF(NEW.updated_by, \'\')::uuid, NULLIF(NEW.updated_by, \'\')::uuid');

  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='coletar_dados_backup';
  EXECUTE replace(replace(d,
    'jsonb_build_object(''os_pecas''', 'jsonb_build_object(''pecas_utilizadas'''),
    'SELECT op.* FROM os_pecas op', 'SELECT op.* FROM pecas_utilizadas op');
END $mig$;

CREATE OR REPLACE FUNCTION admin.mapear_tipo_evento_billing(p_event_type text)
RETURNS admin.tipo_evento_billing
LANGUAGE sql
IMMUTABLE
SET search_path TO 'admin', 'public'
AS $fn$
  SELECT CASE
    WHEN p_event_type IN (SELECT unnest(enum_range(NULL::admin.tipo_evento_billing))::text) THEN p_event_type::admin.tipo_evento_billing
    WHEN p_event_type IN ('customer.subscription.created') THEN 'assinatura_criada'::admin.tipo_evento_billing
    WHEN p_event_type IN ('customer.subscription.trial_will_end') THEN 'trial_terminou'::admin.tipo_evento_billing
    WHEN p_event_type IN ('invoice.paid','invoice.payment_succeeded','checkout.session.completed') THEN 'fatura_paga'::admin.tipo_evento_billing
    WHEN p_event_type IN ('invoice.payment_failed') THEN 'fatura_falhou'::admin.tipo_evento_billing
    WHEN p_event_type IN ('customer.subscription.deleted') THEN 'cancelada'::admin.tipo_evento_billing
    ELSE 'plano_alterado'::admin.tipo_evento_billing
  END
$fn$;

DO $mig2$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='admin' AND p.proname='processar_evento_assinatura';
  EXECUTE replace(d,
    'p_stripe_event_id, p_event_type, v_assinatura_id',
    'p_stripe_event_id, admin.mapear_tipo_evento_billing(p_event_type), v_assinatura_id');
END $mig2$;