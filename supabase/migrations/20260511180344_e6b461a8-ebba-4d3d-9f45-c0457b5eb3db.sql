ALTER TABLE admin.eventos_billing 
  ADD COLUMN IF NOT EXISTS stripe_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_billing_stripe_event_id 
  ON admin.eventos_billing(stripe_event_id) 
  WHERE stripe_event_id IS NOT NULL;

ALTER TABLE admin.assinaturas 
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_end timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_assinaturas_stripe_customer 
  ON admin.assinaturas(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_assinaturas_stripe_subscription 
  ON admin.assinaturas(stripe_subscription_id);

CREATE OR REPLACE FUNCTION admin.processar_evento_assinatura(
  p_stripe_event_id text,
  p_event_type text,
  p_stripe_subscription_id text,
  p_stripe_customer_id text,
  p_empresa_id uuid,
  p_plano_id uuid,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_canceled_at timestamptz,
  p_trial_end timestamptz,
  p_event_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = admin, public
AS $$
DECLARE
  v_assinatura_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM admin.eventos_billing 
    WHERE stripe_event_id = p_stripe_event_id
  ) THEN
    RETURN jsonb_build_object(
      'success', true, 
      'idempotent', true, 
      'message', 'Evento já processado'
    );
  END IF;

  INSERT INTO admin.assinaturas (
    empresa_id, plano_id,
    stripe_subscription_id, stripe_customer_id,
    status, current_period_start, current_period_end,
    cancel_at_period_end, canceled_at, trial_end,
    updated_at
  ) VALUES (
    p_empresa_id, p_plano_id,
    p_stripe_subscription_id, p_stripe_customer_id,
    p_status, p_current_period_start, p_current_period_end,
    p_cancel_at_period_end, p_canceled_at, p_trial_end,
    now()
  )
  ON CONFLICT (stripe_subscription_id) DO UPDATE SET
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    canceled_at = EXCLUDED.canceled_at,
    trial_end = EXCLUDED.trial_end,
    plano_id = COALESCE(EXCLUDED.plano_id, admin.assinaturas.plano_id),
    updated_at = now()
  RETURNING id INTO v_assinatura_id;

  INSERT INTO admin.eventos_billing (
    stripe_event_id, tipo, assinatura_id, empresa_id, payload, created_at
  ) VALUES (
    p_stripe_event_id, p_event_type, v_assinatura_id, p_empresa_id, p_event_payload, now()
  );

  RETURN jsonb_build_object(
    'success', true, 
    'idempotent', false,
    'assinatura_id', v_assinatura_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION admin.processar_evento_assinatura(
  text, text, text, text, uuid, uuid, text, 
  timestamptz, timestamptz, boolean, timestamptz, timestamptz, jsonb
) TO service_role, authenticated;