
-- Update the status enum with new values
ALTER TYPE public.status_ordem RENAME TO status_ordem_old;

CREATE TYPE public.status_ordem AS ENUM (
  'recebido',
  'em_analise',
  'aguardando_aprovacao',
  'em_reparo',
  'pronto',
  'entregue'
);

ALTER TABLE public.ordens_de_servico
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE status_ordem USING (
    CASE status::text
      WHEN 'aguardando_orcamento' THEN 'recebido'::status_ordem
      WHEN 'orcamento_aprovado' THEN 'aguardando_aprovacao'::status_ordem
      WHEN 'em_reparo' THEN 'em_reparo'::status_ordem
      WHEN 'pronto' THEN 'pronto'::status_ordem
      WHEN 'entregue' THEN 'entregue'::status_ordem
      WHEN 'cancelado' THEN 'recebido'::status_ordem
      ELSE 'recebido'::status_ordem
    END
  ),
  ALTER COLUMN status SET DEFAULT 'recebido'::status_ordem;

DROP TYPE public.status_ordem_old;

-- Add new columns
ALTER TABLE public.ordens_de_servico
  ADD COLUMN tecnico text,
  ADD COLUMN previsao_entrega timestamptz;
