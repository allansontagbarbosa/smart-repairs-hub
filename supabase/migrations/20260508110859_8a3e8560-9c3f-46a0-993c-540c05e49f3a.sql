ALTER TABLE admin.eventos_billing ADD COLUMN IF NOT EXISTS stripe_event_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_billing_stripe_event_id ON admin.eventos_billing(stripe_event_id) WHERE stripe_event_id IS NOT NULL;
ALTER TABLE admin.eventos_billing ADD COLUMN IF NOT EXISTS processado_em timestamptz DEFAULT now();
NOTIFY pgrst, 'reload schema';