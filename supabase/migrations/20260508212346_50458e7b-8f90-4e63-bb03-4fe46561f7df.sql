-- 1. Enum dos tipos de prejuízo
DO $$ BEGIN
  CREATE TYPE public.tipo_prejuizo AS ENUM (
    'garantia','peca_danificada','cliente_sumiu','fraude_chargeback',
    'furto_extravio','cancelamento_com_peca','outro'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Tabela principal
CREATE TABLE IF NOT EXISTS public.prejuizos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo public.tipo_prejuizo NOT NULL,
  valor_centavos integer NOT NULL CHECK (valor_centavos >= 0),
  descricao text,
  observacoes text,
  os_origem_id uuid REFERENCES public.ordens_de_servico(id) ON DELETE SET NULL,
  os_retrabalho_id uuid REFERENCES public.ordens_de_servico(id) ON DELETE SET NULL,
  movimentacao_financeira_id uuid REFERENCES public.movimentacoes_financeiras(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','automatico_garantia','automatico_cancelamento')),
  data_evento date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_prejuizos_empresa ON public.prejuizos(empresa_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prejuizos_data_evento ON public.prejuizos(empresa_id, data_evento DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prejuizos_tipo ON public.prejuizos(empresa_id, tipo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prejuizos_os_origem ON public.prejuizos(os_origem_id) WHERE os_origem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prejuizos_os_retrabalho ON public.prejuizos(os_retrabalho_id) WHERE os_retrabalho_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prejuizos_os_retrabalho_unique
  ON public.prejuizos(os_retrabalho_id)
  WHERE os_retrabalho_id IS NOT NULL AND origem = 'automatico_garantia' AND deleted_at IS NULL;

-- 3. RLS
ALTER TABLE public.prejuizos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa isolada" ON public.prejuizos
  FOR ALL
  USING (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()))
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Staff lê todos prejuizos" ON public.prejuizos
  FOR SELECT TO authenticated
  USING (admin.is_staff());

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION public.trg_prejuizos_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS prejuizos_updated_at ON public.prejuizos;
CREATE TRIGGER prejuizos_updated_at
  BEFORE UPDATE ON public.prejuizos
  FOR EACH ROW EXECUTE FUNCTION public.trg_prejuizos_updated_at();

-- 5. Adiciona 'prejuizo' no enum tipo das movimentacoes_financeiras (se houver)
DO $$
DECLARE v_enum_name text;
BEGIN
  SELECT t.typname INTO v_enum_name
  FROM pg_type t
  JOIN pg_attribute a ON a.atttypid = t.oid
  JOIN pg_class c ON c.oid = a.attrelid
  WHERE c.relname = 'movimentacoes_financeiras' AND a.attname = 'tipo' AND t.typtype = 'e';

  IF v_enum_name IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = v_enum_name AND e.enumlabel = 'prejuizo'
    ) THEN
      EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', v_enum_name, 'prejuizo');
    END IF;
  END IF;
END $$;

-- 6. Reload schema cache
NOTIFY pgrst, 'reload schema';