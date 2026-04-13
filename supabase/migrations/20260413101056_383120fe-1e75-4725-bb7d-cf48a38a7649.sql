
-- 1. Add user_id to clientes
ALTER TABLE public.clientes
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_clientes_user_id ON public.clientes(user_id);

-- 2. Create security definer function to check if user is internal staff
CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = _user_id AND ativo = true
  )
$$;

-- 3. Fix ordens_de_servico policies
DROP POLICY IF EXISTS "Anon read orders" ON public.ordens_de_servico;
DROP POLICY IF EXISTS "Authenticated full access" ON public.ordens_de_servico;

-- Internal staff: full access
CREATE POLICY "Staff full access"
ON public.ordens_de_servico
FOR ALL
TO authenticated
USING (public.is_internal_user(auth.uid()))
WITH CHECK (public.is_internal_user(auth.uid()));

-- Portal clients: read only their own orders
CREATE POLICY "Portal client read own orders"
ON public.ordens_de_servico
FOR SELECT
TO authenticated
USING (
  NOT public.is_internal_user(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.aparelhos a
    JOIN public.clientes c ON c.id = a.cliente_id
    WHERE a.id = ordens_de_servico.aparelho_id
      AND c.user_id = auth.uid()
  )
);

-- 4. Fix status_ordem_servico - remove anon, add authenticated read
DROP POLICY IF EXISTS "Anon read status" ON public.status_ordem_servico;

CREATE POLICY "Authenticated read status"
ON public.status_ordem_servico
FOR SELECT
TO authenticated
USING (true);

-- 5. Fix lojas - remove anon read, add authenticated read
DROP POLICY IF EXISTS "Anon read lojas" ON public.lojas;

CREATE POLICY "Authenticated read lojas"
ON public.lojas
FOR SELECT
TO authenticated
USING (true);

-- 6. Fix historico_ordens - remove anon, add proper policies
DROP POLICY IF EXISTS "Anon read history" ON public.historico_ordens;

CREATE POLICY "Staff read all history"
ON public.historico_ordens
FOR SELECT
TO authenticated
USING (public.is_internal_user(auth.uid()));

CREATE POLICY "Portal client read own history"
ON public.historico_ordens
FOR SELECT
TO authenticated
USING (
  NOT public.is_internal_user(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.ordens_de_servico o
    JOIN public.aparelhos a ON a.id = o.aparelho_id
    JOIN public.clientes c ON c.id = a.cliente_id
    WHERE o.id = historico_ordens.ordem_id
      AND c.user_id = auth.uid()
  )
);

-- Keep existing "Authenticated full access" on historico_ordens for write ops
-- (it was already there for insert/update/delete)

-- 7. Fix formas_pagamento - remove anon
DROP POLICY IF EXISTS "Anon read formas_pagamento" ON public.formas_pagamento;

CREATE POLICY "Authenticated read formas_pagamento"
ON public.formas_pagamento
FOR SELECT
TO authenticated
USING (true);
