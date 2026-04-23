-- SU-01: handle_new_user respeita raw_user_meta_data de convite
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_metadata jsonb;
  v_empresa_id uuid;
  v_perfil_id uuid;
BEGIN
  v_metadata := NEW.raw_user_meta_data;
  v_empresa_id := NULLIF(v_metadata->>'empresa_id','')::uuid;
  v_perfil_id := NULLIF(v_metadata->>'perfil_id','')::uuid;

  INSERT INTO public.user_profiles (user_id, nome_exibicao, empresa_id, perfil_id, ativo)
  VALUES (
    NEW.id,
    COALESCE(v_metadata->>'full_name', NEW.email),
    v_empresa_id,
    v_perfil_id,
    true
  )
  ON CONFLICT (user_id) DO UPDATE SET
    empresa_id = COALESCE(EXCLUDED.empresa_id, public.user_profiles.empresa_id),
    perfil_id = COALESCE(EXCLUDED.perfil_id, public.user_profiles.perfil_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- AUD-02: triggers de auditoria em tabelas financeiras críticas
DROP TRIGGER IF EXISTS audit_contas_a_pagar ON public.contas_a_pagar;
CREATE TRIGGER audit_contas_a_pagar
  AFTER INSERT OR UPDATE OR DELETE ON public.contas_a_pagar
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

DROP TRIGGER IF EXISTS audit_recebimentos ON public.recebimentos;
CREATE TRIGGER audit_recebimentos
  AFTER INSERT OR UPDATE OR DELETE ON public.recebimentos
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

DROP TRIGGER IF EXISTS audit_comissoes ON public.comissoes;
CREATE TRIGGER audit_comissoes
  AFTER INSERT OR UPDATE OR DELETE ON public.comissoes
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

DROP TRIGGER IF EXISTS audit_funcionarios ON public.funcionarios;
CREATE TRIGGER audit_funcionarios
  AFTER INSERT OR UPDATE OR DELETE ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();