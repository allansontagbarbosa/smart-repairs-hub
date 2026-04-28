ALTER TABLE public.contas_a_pagar
ADD COLUMN IF NOT EXISTS mes_competencia text;

UPDATE public.contas_a_pagar
SET mes_competencia = '2026-04'
WHERE descricao ILIKE '%Motoboy Lucas%'
  AND data_vencimento >= DATE '2026-05-01'
  AND data_vencimento < DATE '2026-06-01';

UPDATE public.contas_a_pagar
SET mes_competencia = to_char(data_vencimento - INTERVAL '1 month', 'YYYY-MM')
WHERE mes_competencia IS NULL
  AND recorrente = TRUE;

UPDATE public.contas_a_pagar
SET mes_competencia = to_char(data_vencimento, 'YYYY-MM')
WHERE mes_competencia IS NULL
  AND recorrente = FALSE;