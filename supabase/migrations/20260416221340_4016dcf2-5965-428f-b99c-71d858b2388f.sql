-- Clientes: dados completos para cadastro profissional
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS rua text,
  ADD COLUMN IF NOT EXISTS numero_endereco text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS origem text;

-- Ordens de Serviço: dados de recebimento do aparelho + relato + contato + aprovação no ato
ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS liga text DEFAULT 'sim',
  ADD COLUMN IF NOT EXISTS bateria_entrada integer,
  ADD COLUMN IF NOT EXISTS estado_geral text,
  ADD COLUMN IF NOT EXISTS imei2 text,
  ADD COLUMN IF NOT EXISTS relato_cliente text,
  ADD COLUMN IF NOT EXISTS contato_preferido text DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS aprovado_no_ato boolean DEFAULT false;

-- Constraints leves
ALTER TABLE public.ordens_de_servico
  DROP CONSTRAINT IF EXISTS ordens_liga_check,
  ADD CONSTRAINT ordens_liga_check CHECK (liga IS NULL OR liga IN ('sim', 'nao', 'parcial'));

ALTER TABLE public.ordens_de_servico
  DROP CONSTRAINT IF EXISTS ordens_bateria_check,
  ADD CONSTRAINT ordens_bateria_check CHECK (bateria_entrada IS NULL OR (bateria_entrada >= 0 AND bateria_entrada <= 100));

ALTER TABLE public.ordens_de_servico
  DROP CONSTRAINT IF EXISTS ordens_contato_check,
  ADD CONSTRAINT ordens_contato_check CHECK (contato_preferido IS NULL OR contato_preferido IN ('whatsapp', 'ligacao', 'sms', 'email'));

-- Índice para busca por IMEI no fluxo de Nova OS (cliente por IMEI)
CREATE INDEX IF NOT EXISTS idx_aparelhos_imei ON public.aparelhos(imei) WHERE imei IS NOT NULL;