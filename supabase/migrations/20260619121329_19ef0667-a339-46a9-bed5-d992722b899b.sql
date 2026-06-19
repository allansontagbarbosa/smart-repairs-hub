
-- 1) user_profiles: enforce immutability of perfil_id and ativo via trigger
CREATE OR REPLACE FUNCTION public.prevent_user_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role (edge functions, admin RPCs) to bypass
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.perfil_id IS DISTINCT FROM OLD.perfil_id THEN
    RAISE EXCEPTION 'Alteração de perfil_id não é permitida via UPDATE direto. Use uma RPC apropriada.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.ativo IS DISTINCT FROM OLD.ativo THEN
    RAISE EXCEPTION 'Alteração de ativo não é permitida via UPDATE direto. Use uma RPC apropriada.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_user_profile_privilege_escalation ON public.user_profiles;
CREATE TRIGGER trg_prevent_user_profile_privilege_escalation
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_user_profile_privilege_escalation();

-- Tighten policies (keep the WITH CHECK as defense in depth, but trigger is the real guard)
DROP POLICY IF EXISTS "Admin update empresa profiles" ON public.user_profiles;
CREATE POLICY "Admin update empresa profiles"
ON public.user_profiles
FOR UPDATE
USING (
  is_admin_user(auth.uid())
  AND empresa_id IS NOT NULL
  AND empresa_id = get_my_empresa_id()
)
WITH CHECK (
  is_admin_user(auth.uid())
  AND empresa_id IS NOT NULL
  AND empresa_id = get_my_empresa_id()
);

-- 2) atacado_pedidos_historico: use get_my_empresa_id() like other tenant policies
DROP POLICY IF EXISTS tenant_via_pedido ON public.atacado_pedidos_historico;
CREATE POLICY tenant_via_pedido
ON public.atacado_pedidos_historico
FOR ALL
TO authenticated
USING (
  pedido_id IN (
    SELECT p.id FROM public.atacado_pedidos p
    WHERE p.empresa_id = get_my_empresa_id()
  )
)
WITH CHECK (
  pedido_id IN (
    SELECT p.id FROM public.atacado_pedidos p
    WHERE p.empresa_id = get_my_empresa_id()
  )
);
