-- ETAPA 1.1 — DROP funções/triggers antigas
DROP FUNCTION IF EXISTS public.calcular_cashback_os(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.creditar_cashback_os(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.aplicar_cashback_em_os(uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.ajustar_cashback_cliente(uuid, bigint, text) CASCADE;
DROP FUNCTION IF EXISTS public.cashback_ativar_cliente(uuid, boolean, text) CASCADE;
DROP FUNCTION IF EXISTS public.cashback_set_taxa_categoria(uuid, text, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.cashback_set_taxa_categoria(uuid, text, text, numeric, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.cashback_get_cliente_config(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.cashback_recalcular_retroativo(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.cashback_recalcular_credito_os(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.cashback_recalcular_custo_operacional() CASCADE;
DROP FUNCTION IF EXISTS public.cashback_set_custo_operacional_manual(bigint, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_cashback_empresa_dashboard() CASCADE;
DROP FUNCTION IF EXISTS public.get_meu_cashback() CASCADE;
DROP FUNCTION IF EXISTS public.trg_creditar_cashback_on_pronto() CASCADE;
DROP FUNCTION IF EXISTS public.trg_estornar_cashback_on_cancelada() CASCADE;
DROP FUNCTION IF EXISTS public.trg_bloquear_os_lucro_negativo() CASCADE;
DROP FUNCTION IF EXISTS public.trg_recalcular_cashback_on_change() CASCADE;
DROP FUNCTION IF EXISTS public.trg_recalcular_cashback_on_comissao() CASCADE;

DROP TABLE IF EXISTS public.cashback_regras CASCADE;

-- ETAPA 1.2 — cashback_config
ALTER TABLE public.cashback_config
  ADD COLUMN IF NOT EXISTS custo_operacional_por_os_centavos bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_operacional_modo text DEFAULT 'automatico'
    CHECK (custo_operacional_modo IN ('automatico','manual','desabilitado')),
  ADD COLUMN IF NOT EXISTS custo_operacional_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS custo_operacional_atualizado_por_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS custo_operacional_calculo_decomposicao jsonb;

-- ETAPA 1.3 — cashback_taxas_categoria
ALTER TABLE public.cashback_taxas_categoria
  ADD COLUMN IF NOT EXISTS tipo_taxa text;
ALTER TABLE public.cashback_taxas_categoria
  ADD COLUMN IF NOT EXISTS valor_fixo_centavos bigint;

UPDATE public.cashback_taxas_categoria SET tipo_taxa = 'percentual' WHERE tipo_taxa IS NULL;

ALTER TABLE public.cashback_taxas_categoria
  ALTER COLUMN tipo_taxa SET NOT NULL,
  ALTER COLUMN tipo_taxa SET DEFAULT 'percentual';

ALTER TABLE public.cashback_taxas_categoria
  ALTER COLUMN percentual DROP NOT NULL;

ALTER TABLE public.cashback_taxas_categoria DROP CONSTRAINT IF EXISTS chk_taxa_valor;
ALTER TABLE public.cashback_taxas_categoria DROP CONSTRAINT IF EXISTS chk_tipo_taxa;

ALTER TABLE public.cashback_taxas_categoria
  ADD CONSTRAINT chk_tipo_taxa CHECK (tipo_taxa IN ('percentual','valor_fixo','percentual_lucro'));

ALTER TABLE public.cashback_taxas_categoria
  ADD CONSTRAINT chk_taxa_valor CHECK (
    (tipo_taxa = 'percentual'
     AND percentual IS NOT NULL AND percentual > 0 AND percentual <= 100
     AND valor_fixo_centavos IS NULL)
    OR
    (tipo_taxa = 'valor_fixo'
     AND valor_fixo_centavos IS NOT NULL AND valor_fixo_centavos > 0
     AND percentual IS NULL)
    OR
    (tipo_taxa = 'percentual_lucro'
     AND percentual IS NOT NULL AND percentual > 0 AND percentual <= 100
     AND valor_fixo_centavos IS NULL)
  );

-- ETAPA 1.4 — cashback_movimentacoes
ALTER TABLE public.cashback_movimentacoes
  ADD COLUMN IF NOT EXISTS calc_decomposicao jsonb;

-- ETAPA 1.5 — cashback_audit_log
ALTER TABLE public.cashback_audit_log
  ADD COLUMN IF NOT EXISTS tipo_taxa_anterior text,
  ADD COLUMN IF NOT EXISTS tipo_taxa_novo text;