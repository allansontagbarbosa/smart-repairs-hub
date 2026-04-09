
-- Enum for device stock status
CREATE TYPE public.status_estoque_aparelho AS ENUM ('disponivel', 'em_assistencia', 'em_transporte', 'vendido');

-- Table for device inventory
CREATE TABLE public.estoque_aparelhos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  capacidade TEXT,
  cor TEXT,
  imei TEXT UNIQUE,
  custo_compra NUMERIC DEFAULT 0,
  status status_estoque_aparelho NOT NULL DEFAULT 'disponivel',
  localizacao TEXT,
  data_entrada TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.estoque_aparelhos ENABLE ROW LEVEL SECURITY;

-- Authenticated users have full access
CREATE POLICY "Authenticated full access"
ON public.estoque_aparelhos
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
