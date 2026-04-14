
-- Add permissoes JSONB column to existing perfis_acesso
ALTER TABLE public.perfis_acesso
  ADD COLUMN IF NOT EXISTS permissoes JSONB NOT NULL DEFAULT '{}';

-- Update existing profiles or insert defaults
INSERT INTO public.perfis_acesso (nome_perfil, descricao, permissoes) VALUES
('admin', 'Acesso total ao sistema', '{
  "dashboard": true,
  "assistencia": {"ver": true, "criar": true, "editar": true, "excluir": true},
  "financeiro": {"ver": true, "criar": true, "editar": true, "excluir": true},
  "pecas": {"ver": true, "criar": true, "editar": true, "excluir": true},
  "clientes": {"ver": true, "criar": true, "editar": true, "excluir": true},
  "relatorios": true,
  "configuracoes": true,
  "fila_ia": true
}'::jsonb),
('tecnico', 'Técnico — acesso operacional', '{
  "dashboard": false,
  "assistencia": {"ver": true, "criar": true, "editar": true, "excluir": false},
  "financeiro": {"ver": false, "criar": false, "editar": false, "excluir": false},
  "pecas": {"ver": true, "criar": false, "editar": false, "excluir": false},
  "clientes": {"ver": true, "criar": true, "editar": false, "excluir": false},
  "relatorios": false,
  "configuracoes": false,
  "fila_ia": true
}'::jsonb),
('atendente', 'Atendente — recepção e OS', '{
  "dashboard": true,
  "assistencia": {"ver": true, "criar": true, "editar": true, "excluir": false},
  "financeiro": {"ver": false, "criar": false, "editar": false, "excluir": false},
  "pecas": {"ver": true, "criar": false, "editar": false, "excluir": false},
  "clientes": {"ver": true, "criar": true, "editar": true, "excluir": false},
  "relatorios": false,
  "configuracoes": false,
  "fila_ia": false
}'::jsonb),
('financeiro', 'Financeiro — acesso financeiro', '{
  "dashboard": true,
  "assistencia": {"ver": true, "criar": false, "editar": false, "excluir": false},
  "financeiro": {"ver": true, "criar": true, "editar": true, "excluir": true},
  "pecas": {"ver": true, "criar": false, "editar": false, "excluir": false},
  "clientes": {"ver": true, "criar": false, "editar": false, "excluir": false},
  "relatorios": true,
  "configuracoes": false,
  "fila_ia": false
}'::jsonb)
ON CONFLICT (nome_perfil) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  permissoes = EXCLUDED.permissoes;

-- Create auditoria table
CREATE TABLE IF NOT EXISTS public.auditoria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_nome TEXT,
  acao TEXT NOT NULL,
  tabela TEXT,
  registro_id UUID,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs (using security definer function to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.perfis_acesso pa ON pa.id = up.perfil_id
    WHERE up.user_id = _user_id AND up.ativo = true AND pa.nome_perfil = 'admin'
  )
$$;

CREATE POLICY "Admin read auditoria" ON public.auditoria
  FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "System insert auditoria" ON public.auditoria
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.registrar_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_nome text;
  v_acao text;
  v_registro_id uuid;
BEGIN
  v_user_id := auth.uid();
  SELECT COALESCE(nome_exibicao, 'Sistema') INTO v_user_nome
    FROM public.user_profiles WHERE user_id = v_user_id LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    v_acao := 'criou';
    v_registro_id := NEW.id;
    INSERT INTO public.auditoria (user_id, user_nome, acao, tabela, registro_id, dados_novos)
    VALUES (v_user_id, v_user_nome, v_acao, TG_TABLE_NAME, v_registro_id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao := 'atualizou';
    v_registro_id := NEW.id;
    INSERT INTO public.auditoria (user_id, user_nome, acao, tabela, registro_id, dados_anteriores, dados_novos)
    VALUES (v_user_id, v_user_nome, v_acao, TG_TABLE_NAME, v_registro_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'excluiu';
    v_registro_id := OLD.id;
    INSERT INTO public.auditoria (user_id, user_nome, acao, tabela, registro_id, dados_anteriores)
    VALUES (v_user_id, v_user_nome, v_acao, TG_TABLE_NAME, v_registro_id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach audit triggers to critical tables
CREATE TRIGGER audit_ordens_de_servico
AFTER INSERT OR UPDATE OR DELETE ON public.ordens_de_servico
FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

CREATE TRIGGER audit_estoque_itens
AFTER INSERT OR UPDATE OR DELETE ON public.estoque_itens
FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();

CREATE TRIGGER audit_perfis_acesso
AFTER INSERT OR UPDATE OR DELETE ON public.perfis_acesso
FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria();
