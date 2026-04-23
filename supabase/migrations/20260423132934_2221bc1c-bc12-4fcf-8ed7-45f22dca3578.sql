-- =========================================================================
-- Portal do Técnico — schema de backend
-- Adaptado ao schema real do AssistPro:
--   * Tabela de OS = ordens_de_servico
--   * Técnico identificado por funcionario_id (FK para funcionarios)
--   * Comissões já existentes (tabela `comissoes` + trigger gerar_comissao_automatica) preservadas
--   * Peças utilizadas já existentes (tabela `pecas_utilizadas`) preservadas
--   * Status técnico mapeado para coluna `status` existente, sem coluna paralela
-- =========================================================================

-- 1) get_my_role() — devolve o nome do perfil do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT pa.nome_perfil
  FROM public.user_profiles up
  JOIN public.perfis_acesso pa ON pa.id = up.perfil_id
  WHERE (up.user_id = auth.uid() OR up.id = auth.uid())
    AND up.ativo = true
  ORDER BY up.created_at ASC
  LIMIT 1;
$$;

-- 2) Coluna tipo_servico em ordens_de_servico (texto livre, espelho do tipos_servico.nome)
ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS tipo_servico text;

-- =========================================================================
-- 3) tecnicos_metas — metas individuais mensais (por funcionário/técnico)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.tecnicos_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  funcionario_id uuid NOT NULL,
  ano int NOT NULL,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  meta_quantidade_os int DEFAULT 0,
  meta_valor_servicos numeric(10,2) DEFAULT 0,
  salario_base numeric(10,2) DEFAULT 0,
  bonus_meta_batida numeric(10,2) DEFAULT 0,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, ano, mes)
);

ALTER TABLE public.tecnicos_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tecnico_le_propria_meta"
ON public.tecnicos_metas FOR SELECT
TO authenticated
USING (
  empresa_id = get_my_empresa_id()
  AND (
    get_my_role() IN ('admin','Administrador','Gerente','Financeiro','financeiro','gerente')
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE (up.user_id = auth.uid() OR up.id = auth.uid())
        AND up.funcionario_id = tecnicos_metas.funcionario_id
    )
  )
);

CREATE POLICY "admin_gestao_metas"
ON public.tecnicos_metas FOR ALL
TO authenticated
USING (
  empresa_id = get_my_empresa_id()
  AND get_my_role() IN ('admin','Administrador','Gerente','gerente','Financeiro','financeiro')
)
WITH CHECK (
  empresa_id = get_my_empresa_id()
  AND get_my_role() IN ('admin','Administrador','Gerente','gerente','Financeiro','financeiro')
);

CREATE TRIGGER trg_tecnicos_metas_set_empresa
BEFORE INSERT ON public.tecnicos_metas
FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

CREATE TRIGGER trg_tecnicos_metas_updated
BEFORE UPDATE ON public.tecnicos_metas
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- =========================================================================
-- 4) equipe_metas — metas mensais da equipe/empresa
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.equipe_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  ano int NOT NULL,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  meta_quantidade_os int DEFAULT 0,
  meta_faturamento numeric(10,2) DEFAULT 0,
  bonus_equipe_batida numeric(10,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, ano, mes)
);

ALTER TABLE public.equipe_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipe_metas_tenant_read"
ON public.equipe_metas FOR SELECT
TO authenticated
USING (empresa_id = get_my_empresa_id());

CREATE POLICY "equipe_metas_admin_write"
ON public.equipe_metas FOR ALL
TO authenticated
USING (
  empresa_id = get_my_empresa_id()
  AND get_my_role() IN ('admin','Administrador','Gerente','gerente','Financeiro','financeiro')
)
WITH CHECK (
  empresa_id = get_my_empresa_id()
  AND get_my_role() IN ('admin','Administrador','Gerente','gerente','Financeiro','financeiro')
);

CREATE TRIGGER trg_equipe_metas_set_empresa
BEFORE INSERT ON public.equipe_metas
FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

CREATE TRIGGER trg_equipe_metas_updated
BEFORE UPDATE ON public.equipe_metas
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- =========================================================================
-- 5) os_transferencias — transferência de OS entre técnicos
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.os_transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  ordem_id uuid NOT NULL REFERENCES public.ordens_de_servico(id) ON DELETE CASCADE,
  funcionario_origem_id uuid NOT NULL,
  funcionario_destino_id uuid NOT NULL,
  motivo text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aceita','recusada','cancelada')),
  resposta_observacao text,
  solicitado_por uuid,
  respondido_por uuid,
  data_solicitacao timestamptz NOT NULL DEFAULT now(),
  data_resposta timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.os_transferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_transferencias_visiveis"
ON public.os_transferencias FOR SELECT
TO authenticated
USING (
  empresa_id = get_my_empresa_id()
  AND (
    get_my_role() IN ('admin','Administrador','Gerente','gerente')
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE (up.user_id = auth.uid() OR up.id = auth.uid())
        AND up.funcionario_id IN (os_transferencias.funcionario_origem_id, os_transferencias.funcionario_destino_id)
    )
  )
);

CREATE POLICY "os_transferencias_insert"
ON public.os_transferencias FOR INSERT
TO authenticated
WITH CHECK (empresa_id = get_my_empresa_id());

CREATE POLICY "os_transferencias_update"
ON public.os_transferencias FOR UPDATE
TO authenticated
USING (
  empresa_id = get_my_empresa_id()
  AND (
    get_my_role() IN ('admin','Administrador','Gerente','gerente')
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE (up.user_id = auth.uid() OR up.id = auth.uid())
        AND up.funcionario_id IN (os_transferencias.funcionario_origem_id, os_transferencias.funcionario_destino_id)
    )
  )
);

CREATE TRIGGER trg_os_transferencias_set_empresa
BEFORE INSERT ON public.os_transferencias
FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

-- =========================================================================
-- 6) checklist_templates — templates de checklist por tipo de aparelho
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_templates_tenant"
ON public.checklist_templates FOR ALL
TO authenticated
USING (empresa_id = get_my_empresa_id())
WITH CHECK (empresa_id = get_my_empresa_id());

CREATE TRIGGER trg_checklist_templates_set_empresa
BEFORE INSERT ON public.checklist_templates
FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

CREATE TRIGGER trg_checklist_templates_updated
BEFORE UPDATE ON public.checklist_templates
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- =========================================================================
-- 7) os_checklist_saida — checklist preenchido por OS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.os_checklist_saida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  ordem_id uuid NOT NULL REFERENCES public.ordens_de_servico(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_label text NOT NULL,
  testado boolean NOT NULL DEFAULT false,
  observacao text,
  testado_por uuid,
  testado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.os_checklist_saida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_checklist_saida_tenant"
ON public.os_checklist_saida FOR ALL
TO authenticated
USING (empresa_id = get_my_empresa_id())
WITH CHECK (empresa_id = get_my_empresa_id());

CREATE TRIGGER trg_os_checklist_saida_set_empresa
BEFORE INSERT ON public.os_checklist_saida
FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

-- =========================================================================
-- 8) os_fotos — fotos antes/depois/defeito/peça
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.os_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  ordem_id uuid NOT NULL REFERENCES public.ordens_de_servico(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('antes','depois','defeito','peca')),
  url_storage text NOT NULL,
  legenda text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.os_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "os_fotos_tenant"
ON public.os_fotos FOR ALL
TO authenticated
USING (empresa_id = get_my_empresa_id())
WITH CHECK (empresa_id = get_my_empresa_id());

CREATE TRIGGER trg_os_fotos_set_empresa
BEFORE INSERT ON public.os_fotos
FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

-- =========================================================================
-- 9) assinaturas_digitais — assinaturas técnico/cliente
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.assinaturas_digitais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  ordem_id uuid NOT NULL REFERENCES public.ordens_de_servico(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('tecnico_conclusao','cliente_entrega')),
  signatario_nome text NOT NULL,
  signatario_user_id uuid,
  assinatura_base64 text NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assinaturas_digitais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assinaturas_tenant"
ON public.assinaturas_digitais FOR ALL
TO authenticated
USING (empresa_id = get_my_empresa_id())
WITH CHECK (empresa_id = get_my_empresa_id());

CREATE TRIGGER trg_assinaturas_set_empresa
BEFORE INSERT ON public.assinaturas_digitais
FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

-- =========================================================================
-- 10) Storage buckets privados (os-fotos, assinaturas) com RLS por empresa
--     Convenção: arquivos salvos em <empresa_id>/<ordem_id>/<arquivo>
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('os-fotos', 'os-fotos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('assinaturas', 'assinaturas', false)
ON CONFLICT (id) DO NOTHING;

-- Policies para os-fotos
CREATE POLICY "os_fotos_read_empresa"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'os-fotos'
  AND (storage.foldername(name))[1] = get_my_empresa_id()::text
);

CREATE POLICY "os_fotos_insert_empresa"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'os-fotos'
  AND (storage.foldername(name))[1] = get_my_empresa_id()::text
);

CREATE POLICY "os_fotos_update_empresa"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'os-fotos'
  AND (storage.foldername(name))[1] = get_my_empresa_id()::text
);

CREATE POLICY "os_fotos_delete_empresa"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'os-fotos'
  AND (storage.foldername(name))[1] = get_my_empresa_id()::text
);

-- Policies para assinaturas
CREATE POLICY "assinaturas_read_empresa"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'assinaturas'
  AND (storage.foldername(name))[1] = get_my_empresa_id()::text
);

CREATE POLICY "assinaturas_insert_empresa"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assinaturas'
  AND (storage.foldername(name))[1] = get_my_empresa_id()::text
);

CREATE POLICY "assinaturas_update_empresa"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assinaturas'
  AND (storage.foldername(name))[1] = get_my_empresa_id()::text
);

CREATE POLICY "assinaturas_delete_empresa"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'assinaturas'
  AND (storage.foldername(name))[1] = get_my_empresa_id()::text
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_tecnicos_metas_func_periodo ON public.tecnicos_metas (funcionario_id, ano, mes);
CREATE INDEX IF NOT EXISTS idx_equipe_metas_periodo ON public.equipe_metas (empresa_id, ano, mes);
CREATE INDEX IF NOT EXISTS idx_os_transferencias_ordem ON public.os_transferencias (ordem_id);
CREATE INDEX IF NOT EXISTS idx_os_transferencias_destino ON public.os_transferencias (funcionario_destino_id, status);
CREATE INDEX IF NOT EXISTS idx_os_checklist_ordem ON public.os_checklist_saida (ordem_id);
CREATE INDEX IF NOT EXISTS idx_os_fotos_ordem ON public.os_fotos (ordem_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_ordem ON public.assinaturas_digitais (ordem_id);
