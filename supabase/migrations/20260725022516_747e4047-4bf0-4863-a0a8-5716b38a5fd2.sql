
-- 1) atacado_catalogo_credenciais: revogar qualquer privilégio direto de anon/authenticated.
-- RLS já está habilitada e sem policies (fail-closed). Reforçamos removendo GRANTs diretos.
REVOKE ALL ON TABLE public.atacado_catalogo_credenciais FROM PUBLIC;
REVOKE ALL ON TABLE public.atacado_catalogo_credenciais FROM anon;
REVOKE ALL ON TABLE public.atacado_catalogo_credenciais FROM authenticated;
GRANT ALL ON TABLE public.atacado_catalogo_credenciais TO service_role;

COMMENT ON TABLE public.atacado_catalogo_credenciais IS
  'Armazena senha_hash de acesso ao catálogo B2B. Acesso APENAS via RPCs SECURITY DEFINER; nenhuma policy RLS concede leitura direta. Não conceder GRANT a anon/authenticated.';

-- 2) user_profiles: trigger de imutabilidade para colunas sensíveis em self-update.
CREATE OR REPLACE FUNCTION public.user_profiles_prevent_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean := false;
  v_is_admin boolean := false;
BEGIN
  -- service_role e staff admin bypassam a trava (edições legítimas via painel admin/RPCs).
  BEGIN
    v_is_staff := admin.is_staff();
  EXCEPTION WHEN OTHERS THEN
    v_is_staff := false;
  END;

  IF current_setting('role', true) = 'service_role' OR v_is_staff THEN
    RETURN NEW;
  END IF;

  -- Admin da mesma empresa pode alterar (compatível com a policy "Admin update empresa profiles").
  v_is_admin := public.is_admin_user(auth.uid());
  IF v_is_admin AND OLD.empresa_id = NEW.empresa_id THEN
    RETURN NEW;
  END IF;

  -- Para o próprio usuário: bloquear alteração de campos sensíveis.
  IF NEW.user_id = auth.uid() THEN
    IF NEW.perfil_id IS DISTINCT FROM OLD.perfil_id THEN
      RAISE EXCEPTION 'Não é permitido alterar perfil_id do próprio usuário' USING ERRCODE = '42501';
    END IF;
    IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
      RAISE EXCEPTION 'Não é permitido alterar empresa_id do próprio usuário' USING ERRCODE = '42501';
    END IF;
    IF NEW.funcionario_id IS DISTINCT FROM OLD.funcionario_id THEN
      RAISE EXCEPTION 'Não é permitido alterar funcionario_id do próprio usuário' USING ERRCODE = '42501';
    END IF;
    IF NEW.ativo IS DISTINCT FROM OLD.ativo THEN
      RAISE EXCEPTION 'Não é permitido alterar ativo do próprio usuário' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_prevent_priv_escalation ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_prevent_priv_escalation
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.user_profiles_prevent_privilege_escalation();
