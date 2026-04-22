-- Passo 6: migrar dados existentes para o sistema de custo médio ponderado
-- 1) Permite a origem 'migracao_inicial' no histórico de custo
ALTER TABLE public.historico_custo_peca
  DROP CONSTRAINT IF EXISTS historico_custo_peca_origem_check;

ALTER TABLE public.historico_custo_peca
  ADD CONSTRAINT historico_custo_peca_origem_check
  CHECK (origem = ANY (ARRAY[
    'compra_formal'::text,
    'entrada_direta'::text,
    'ajuste_inicial'::text,
    'ajuste_manual'::text,
    'migracao_inicial'::text
  ]));

-- 2) Para cada peça com custo_medio = 0 mas custo_unitario antigo > 0, copia o valor
--    e grava registro de auditoria em historico_custo_peca.
WITH a_migrar AS (
  SELECT id, empresa_id, custo_unitario, quantidade
  FROM public.estoque_itens
  WHERE deleted_at IS NULL
    AND COALESCE(custo_medio, 0) = 0
    AND COALESCE(custo_unitario, 0) > 0
)
UPDATE public.estoque_itens ei
SET custo_medio = m.custo_unitario
FROM a_migrar m
WHERE ei.id = m.id;

-- 3) Histórico das migrações (registra somente o que de fato foi alterado agora)
INSERT INTO public.historico_custo_peca (
  empresa_id, peca_id, custo_anterior, custo_novo,
  quantidade_anterior, quantidade_movimentada, preco_compra_unitario,
  origem, registrado_em
)
SELECT
  ei.empresa_id, ei.id, 0, ei.custo_medio,
  ei.quantidade, 0, ei.custo_medio,
  'migracao_inicial', NOW()
FROM public.estoque_itens ei
WHERE ei.deleted_at IS NULL
  AND ei.custo_medio > 0
  AND ei.custo_medio = ei.custo_unitario
  AND NOT EXISTS (
    SELECT 1 FROM public.historico_custo_peca h
    WHERE h.peca_id = ei.id
  );