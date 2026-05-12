
-- Add 'parcial' to status_conta
ALTER TYPE status_conta ADD VALUE IF NOT EXISTS 'parcial';

-- Forma de pagamento enum
DO $$ BEGIN
  CREATE TYPE forma_pagamento_conta AS ENUM ('pix', 'dinheiro', 'cartao', 'transferencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- valor_pago_centavos em contas_a_pagar
ALTER TABLE contas_a_pagar
  ADD COLUMN IF NOT EXISTS valor_pago_centavos bigint NOT NULL DEFAULT 0;

UPDATE contas_a_pagar
SET valor_pago_centavos = (valor * 100)::bigint
WHERE status = 'paga' AND valor_pago_centavos = 0 AND deleted_at IS NULL;

-- Histórico de pagamentos
CREATE TABLE IF NOT EXISTS contas_pagar_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id),
  conta_pagar_id uuid NOT NULL REFERENCES contas_a_pagar(id) ON DELETE CASCADE,
  valor_centavos bigint NOT NULL CHECK (valor_centavos > 0),
  data_pagamento date NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento forma_pagamento_conta NOT NULL,
  observacao text,
  movimentacao_id uuid REFERENCES movimentacoes_financeiras(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  estornado_em timestamptz,
  estornado_por uuid
);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_pagamentos_conta
  ON contas_pagar_pagamentos(conta_pagar_id, estornado_em);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_pagamentos_empresa
  ON contas_pagar_pagamentos(empresa_id, data_pagamento DESC);

ALTER TABLE contas_pagar_pagamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contas_pagar_pagamentos_all" ON contas_pagar_pagamentos;
CREATE POLICY "contas_pagar_pagamentos_all"
  ON contas_pagar_pagamentos FOR ALL
  TO authenticated
  USING (empresa_id = get_my_empresa_id())
  WITH CHECK (empresa_id = get_my_empresa_id());
