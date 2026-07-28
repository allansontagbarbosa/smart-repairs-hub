-- 1) AVALIACOES: remover insert anônimo amplo e restringir ao cliente dono da OS
DROP POLICY IF EXISTS "avaliacoes_insert_anon_com_os_valida" ON public.avaliacoes;
DROP POLICY IF EXISTS "Empresa insert avaliacoes" ON public.avaliacoes;

REVOKE ALL ON public.avaliacoes FROM anon;

CREATE OR REPLACE FUNCTION public.avaliacoes_set_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT o.empresa_id INTO NEW.empresa_id
  FROM public.ordens_de_servico o
  WHERE o.id = NEW.ordem_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avaliacoes_set_empresa ON public.avaliacoes;
CREATE TRIGGER trg_avaliacoes_set_empresa
BEFORE INSERT ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.avaliacoes_set_empresa();

CREATE UNIQUE INDEX IF NOT EXISTS avaliacoes_ordem_id_uidx ON public.avaliacoes (ordem_id);

CREATE POLICY "avaliacoes_insert_staff"
ON public.avaliacoes FOR INSERT TO authenticated
WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE POLICY "avaliacoes_insert_cliente_dono"
ON public.avaliacoes FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.ordens_de_servico o
    JOIN public.aparelhos ap ON ap.id = o.aparelho_id
    JOIN public.clientes c ON c.id = ap.cliente_id
    WHERE o.id = avaliacoes.ordem_id
      AND o.deleted_at IS NULL
      AND o.status::text = 'entregue'
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "avaliacoes_select_cliente_dono"
ON public.avaliacoes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ordens_de_servico o
    JOIN public.aparelhos ap ON ap.id = o.aparelho_id
    JOIN public.clientes c ON c.id = ap.cliente_id
    WHERE o.id = avaliacoes.ordem_id
      AND c.user_id = auth.uid()
  )
);

-- 2) LOJISTA_USUARIOS: acesso por e-mail somente para registros não reivindicados
DROP POLICY IF EXISTS "lojista_select_por_email" ON public.lojista_usuarios;
DROP POLICY IF EXISTS "lojista_backfill_user_id" ON public.lojista_usuarios;

CREATE POLICY "lojista_select_por_email_nao_reivindicado"
ON public.lojista_usuarios FOR SELECT TO authenticated
USING (
  user_id IS NULL
  AND lower(email) = lower((auth.jwt() ->> 'email'))
  AND COALESCE((auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, true)
);

CREATE POLICY "lojista_backfill_user_id_nao_reivindicado"
ON public.lojista_usuarios FOR UPDATE TO authenticated
USING (
  user_id IS NULL
  AND lower(email) = lower((auth.jwt() ->> 'email'))
)
WITH CHECK (
  lower(email) = lower((auth.jwt() ->> 'email'))
  AND user_id = auth.uid()
);

-- 3) ATACADO_CATALOGO_CREDENCIAIS: negar explicitamente clientes do app
REVOKE ALL ON public.atacado_catalogo_credenciais FROM anon, authenticated;
GRANT ALL ON public.atacado_catalogo_credenciais TO service_role;
ALTER TABLE public.atacado_catalogo_credenciais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credenciais_deny_clients" ON public.atacado_catalogo_credenciais;
CREATE POLICY "credenciais_deny_clients"
ON public.atacado_catalogo_credenciais
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);