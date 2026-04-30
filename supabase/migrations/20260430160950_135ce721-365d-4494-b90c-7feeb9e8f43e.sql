-- Fix do erro "preco_venda_maior_igual_custo" ao registrar compras.
-- A coluna preco_venda é legada (regra "peça é custo, não receita" foi consolidada).
-- Remover a constraint que ainda valida preco_venda >= custo_medio porque hoje
-- preco_venda é sempre 0 (não usado na UI), e qualquer compra com custo > 0 viola.

-- 1. DROP da constraint problemática (idempotente via DO BLOCK)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'preco_venda_maior_igual_custo'
      AND conrelid = 'public.estoque_itens'::regclass
  ) THEN
    ALTER TABLE public.estoque_itens
      DROP CONSTRAINT preco_venda_maior_igual_custo;
    RAISE NOTICE 'Constraint preco_venda_maior_igual_custo removida.';
  ELSE
    RAISE NOTICE 'Constraint preco_venda_maior_igual_custo já não existia.';
  END IF;
END $$;

-- 2. Cleanup das 5 compras zumbi
DO $$
DECLARE
  v_compras_zumbi uuid[] := ARRAY[
    '1cc1c032-ae00-4085-867e-e125121fe719',
    '61c477c9-cc8e-438a-90d7-d474929772fa',
    '028ae387-4ca3-46fc-b018-36f57053a74d',
    '396575c0-4c10-4aa5-8912-885608218dee',
    'cf9797cd-da4a-40fe-96bd-3396906d7435'
  ]::uuid[];
BEGIN
  DELETE FROM public.entradas_estoque_itens
   WHERE entrada_id = ANY(v_compras_zumbi);

  DELETE FROM public.entradas_estoque
   WHERE id = ANY(v_compras_zumbi);

  RAISE NOTICE '5 compras zumbi removidas. /compras agora deve mostrar apenas as 3 compras válidas (VIDRO 13).';
END $$;