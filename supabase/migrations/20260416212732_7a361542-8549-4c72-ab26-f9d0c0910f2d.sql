-- Tabela de vínculo N:N entre tipos_servico e estoque_itens (peças)
CREATE TABLE IF NOT EXISTS public.servico_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id uuid NOT NULL REFERENCES public.tipos_servico(id) ON DELETE CASCADE,
  peca_id uuid NOT NULL REFERENCES public.estoque_itens(id) ON DELETE RESTRICT,
  quantidade numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  obrigatoria boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  empresa_id uuid REFERENCES public.empresas(id),
  UNIQUE (servico_id, peca_id)
);

CREATE INDEX IF NOT EXISTS idx_servico_pecas_servico ON public.servico_pecas(servico_id);
CREATE INDEX IF NOT EXISTS idx_servico_pecas_peca ON public.servico_pecas(peca_id);
CREATE INDEX IF NOT EXISTS idx_servico_pecas_empresa ON public.servico_pecas(empresa_id);

ALTER TABLE public.servico_pecas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa isolada"
  ON public.servico_pecas FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE TRIGGER set_empresa_id_servico_pecas
  BEFORE INSERT ON public.servico_pecas
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();