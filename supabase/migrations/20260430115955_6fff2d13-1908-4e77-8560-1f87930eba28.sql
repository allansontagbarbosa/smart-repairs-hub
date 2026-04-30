DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'estoque_movimentos_tipo_check'
      AND conrelid = 'public.estoque_movimentos'::regclass
  ) THEN
    ALTER TABLE public.estoque_movimentos
      DROP CONSTRAINT estoque_movimentos_tipo_check;
  END IF;

  ALTER TABLE public.estoque_movimentos
    ADD CONSTRAINT estoque_movimentos_tipo_check
    CHECK (tipo IN (
      'saida_os',
      'entrada_os',
      'entrada_compra',
      'compra',
      'ajuste'
    ));
END $$;