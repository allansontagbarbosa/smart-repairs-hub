
-- 1. Tabela lojistas
CREATE TABLE public.lojistas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id),
  nome TEXT NOT NULL,
  razao_social TEXT,
  cnpj TEXT,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  responsavel TEXT,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
ALTER TABLE public.lojistas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa_acesso" ON public.lojistas
  FOR ALL TO authenticated
  USING (empresa_id = get_my_empresa_id())
  WITH CHECK (empresa_id = get_my_empresa_id());

-- Trigger para auto-preencher empresa_id
CREATE TRIGGER set_lojistas_empresa_id
  BEFORE INSERT ON public.lojistas
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

-- 2. Tabela lojista_usuarios
CREATE TABLE public.lojista_usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lojista_id UUID REFERENCES public.lojistas(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.lojista_usuarios ENABLE ROW LEVEL SECURITY;

-- Lojista vê apenas seu próprio registro
CREATE POLICY "lojista_proprio_select" ON public.lojista_usuarios
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Staff interno pode gerenciar
CREATE POLICY "staff_manage_lojista_usuarios" ON public.lojista_usuarios
  FOR ALL TO authenticated
  USING (is_internal_user(auth.uid()))
  WITH CHECK (is_internal_user(auth.uid()));

-- 3. Função auxiliar get_my_lojista_id
CREATE OR REPLACE FUNCTION public.get_my_lojista_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lojista_id FROM public.lojista_usuarios
  WHERE user_id = auth.uid() AND ativo = true
  LIMIT 1;
$$;

-- 4. Adicionar lojista_id em clientes e ordens_de_servico
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS lojista_id UUID REFERENCES public.lojistas(id);
CREATE INDEX IF NOT EXISTS idx_clientes_lojista_id ON public.clientes(lojista_id);

ALTER TABLE public.ordens_de_servico ADD COLUMN IF NOT EXISTS lojista_id UUID REFERENCES public.lojistas(id);
CREATE INDEX IF NOT EXISTS idx_os_lojista_id ON public.ordens_de_servico(lojista_id);

-- 5. RLS para lojistas verem suas OS
CREATE POLICY "lojista_read_own_os" ON public.ordens_de_servico
  FOR SELECT TO authenticated
  USING (
    NOT is_internal_user(auth.uid())
    AND lojista_id = get_my_lojista_id()
    AND get_my_lojista_id() IS NOT NULL
  );

-- 6. Lojistas podem ver aparelhos das suas OS
CREATE POLICY "lojista_read_aparelhos" ON public.aparelhos
  FOR SELECT TO authenticated
  USING (
    NOT is_internal_user(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.ordens_de_servico os
      WHERE os.aparelho_id = aparelhos.id
      AND os.lojista_id = get_my_lojista_id()
    )
  );

-- 7. Lojistas podem ver garantias das suas OS
CREATE POLICY "lojista_read_garantias" ON public.garantias
  FOR SELECT TO authenticated
  USING (
    NOT is_internal_user(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.ordens_de_servico os
      WHERE os.id = garantias.ordem_id
      AND os.lojista_id = get_my_lojista_id()
    )
  );
