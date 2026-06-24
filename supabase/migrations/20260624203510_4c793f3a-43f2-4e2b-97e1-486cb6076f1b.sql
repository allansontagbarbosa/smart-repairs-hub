
-- =========================================================================
-- 1) Move senha_hash to a separate, locked-down credentials table
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.atacado_catalogo_credenciais (
  acesso_id uuid PRIMARY KEY REFERENCES public.atacado_catalogo_acessos(id) ON DELETE CASCADE,
  senha_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No grants to anon/authenticated. Only service_role and SECURITY DEFINER functions touch it.
GRANT ALL ON public.atacado_catalogo_credenciais TO service_role;

ALTER TABLE public.atacado_catalogo_credenciais ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon/authenticated, even if grants were accidentally added.
-- SECURITY DEFINER functions below run as table owner and bypass RLS as needed.

-- Backfill from existing column
INSERT INTO public.atacado_catalogo_credenciais (acesso_id, senha_hash)
SELECT id, senha_hash
FROM public.atacado_catalogo_acessos
WHERE senha_hash IS NOT NULL
ON CONFLICT (acesso_id) DO NOTHING;

-- Drop the sensitive column from the readable table
ALTER TABLE public.atacado_catalogo_acessos DROP COLUMN IF EXISTS senha_hash;

-- =========================================================================
-- 2) Update RPCs to use the new credentials table
-- =========================================================================

CREATE OR REPLACE FUNCTION public.catalogo_login(p_slug text, p_email text, p_senha text)
RETURNS TABLE(acesso_id uuid, cliente_id uuid, cliente_nome text, empresa_id uuid, token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_acesso public.atacado_catalogo_acessos%ROWTYPE;
  v_cliente public.atacado_clientes%ROWTYPE;
  v_empresa_id uuid;
  v_hash text;
BEGIN
  SELECT ac.empresa_id INTO v_empresa_id
  FROM public.atacado_configuracoes ac
  WHERE ac.catalogo_publico_slug = p_slug AND ac.catalogo_publico_ativo = true;

  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Catálogo não encontrado ou desativado'; END IF;

  SELECT * INTO v_acesso FROM public.atacado_catalogo_acessos
  WHERE email_login = LOWER(p_email) AND ativo = true;

  IF v_acesso.id IS NULL THEN RAISE EXCEPTION 'E-mail não cadastrado'; END IF;

  SELECT senha_hash INTO v_hash FROM public.atacado_catalogo_credenciais
  WHERE acesso_id = v_acesso.id;

  IF v_hash IS NULL THEN RAISE EXCEPTION 'Senha não configurada'; END IF;

  SELECT * INTO v_cliente FROM public.atacado_clientes
  WHERE id = v_acesso.cliente_id AND empresa_id = v_empresa_id
    AND status NOT IN ('bloqueado', 'inativo') AND deleted_at IS NULL;

  IF v_cliente.id IS NULL THEN RAISE EXCEPTION 'Acesso bloqueado. Contate o fornecedor.'; END IF;
  IF v_hash <> crypt(p_senha, v_hash) THEN
    RAISE EXCEPTION 'Senha incorreta';
  END IF;

  UPDATE public.atacado_catalogo_acessos SET ultimo_login = NOW() WHERE id = v_acesso.id;

  RETURN QUERY SELECT v_acesso.id, v_cliente.id,
    COALESCE(v_cliente.nome_fantasia, v_cliente.razao_social),
    v_empresa_id,
    encode(gen_random_bytes(32), 'hex');
END; $function$;

CREATE OR REPLACE FUNCTION public.catalogo_setar_senha(p_cliente_id uuid, p_email text, p_senha text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_acesso_id uuid; v_hash text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.atacado_clientes c
    JOIN public.user_profiles up ON up.empresa_id = c.empresa_id
    WHERE c.id = p_cliente_id AND up.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  v_hash := crypt(p_senha, gen_salt('bf'));

  INSERT INTO public.atacado_catalogo_acessos (cliente_id, email_login, ativo)
  VALUES (p_cliente_id, LOWER(p_email), true)
  ON CONFLICT (email_login) DO UPDATE SET
    ativo = true, cliente_id = EXCLUDED.cliente_id
  RETURNING id INTO v_acesso_id;

  INSERT INTO public.atacado_catalogo_credenciais (acesso_id, senha_hash)
  VALUES (v_acesso_id, v_hash)
  ON CONFLICT (acesso_id) DO UPDATE SET
    senha_hash = EXCLUDED.senha_hash,
    updated_at = now();

  RETURN v_acesso_id;
END; $function$;

-- =========================================================================
-- 3) Tighten notificacoes policies: split personal vs admin-wide rows
-- =========================================================================

DROP POLICY IF EXISTS notif_select_own ON public.notificacoes;
DROP POLICY IF EXISTS notif_insert_self ON public.notificacoes;
DROP POLICY IF EXISTS notif_update_own ON public.notificacoes;
DROP POLICY IF EXISTS notif_delete_own ON public.notificacoes;

-- SELECT: own row only (strict user_id = auth.uid())
CREATE POLICY notif_select_self ON public.notificacoes
FOR SELECT TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND user_id = auth.uid()
);

-- SELECT: admin/socio can also see company-wide (user_id IS NULL) notifications
CREATE POLICY notif_select_admin_global ON public.notificacoes
FOR SELECT TO authenticated
USING (
  empresa_id = public.get_my_empresa_id()
  AND user_id IS NULL
  AND (public.is_admin_user(auth.uid()) OR public.is_adm_ou_socio())
);

-- INSERT: own row
CREATE POLICY notif_insert_self ON public.notificacoes
FOR INSERT TO authenticated
WITH CHECK (
  empresa_id = public.get_my_empresa_id()
  AND user_id = auth.uid()
);

-- INSERT: admin/socio can post company-wide rows
CREATE POLICY notif_insert_admin_global ON public.notificacoes
FOR INSERT TO authenticated
WITH CHECK (
  empresa_id = public.get_my_empresa_id()
  AND user_id IS NULL
  AND (public.is_admin_user(auth.uid()) OR public.is_adm_ou_socio())
);

-- UPDATE: own row
CREATE POLICY notif_update_self ON public.notificacoes
FOR UPDATE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND user_id = auth.uid())
WITH CHECK (empresa_id = public.get_my_empresa_id() AND user_id = auth.uid());

-- UPDATE: admin/socio over company-wide rows
CREATE POLICY notif_update_admin_global ON public.notificacoes
FOR UPDATE TO authenticated
USING (
  empresa_id = public.get_my_empresa_id() AND user_id IS NULL
  AND (public.is_admin_user(auth.uid()) OR public.is_adm_ou_socio())
)
WITH CHECK (
  empresa_id = public.get_my_empresa_id() AND user_id IS NULL
  AND (public.is_admin_user(auth.uid()) OR public.is_adm_ou_socio())
);

-- DELETE: own row
CREATE POLICY notif_delete_self ON public.notificacoes
FOR DELETE TO authenticated
USING (empresa_id = public.get_my_empresa_id() AND user_id = auth.uid());

-- DELETE: admin/socio over company-wide rows
CREATE POLICY notif_delete_admin_global ON public.notificacoes
FOR DELETE TO authenticated
USING (
  empresa_id = public.get_my_empresa_id() AND user_id IS NULL
  AND (public.is_admin_user(auth.uid()) OR public.is_adm_ou_socio())
);
