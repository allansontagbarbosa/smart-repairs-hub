-- 1) Adicionar coluna categoria em tipos_servico
ALTER TABLE public.tipos_servico ADD COLUMN IF NOT EXISTS categoria text;

-- 2) Migrar tipos_defeito → tipos_servico (skip duplicados case-insensitive)
INSERT INTO public.tipos_servico (nome, valor_padrao, categoria, ativo, created_at, empresa_id)
SELECT d.nome, d.valor_mao_obra, d.categoria, d.ativo, COALESCE(d.created_at, now()), d.empresa_id
FROM public.tipos_defeito d
WHERE NOT EXISTS (
  SELECT 1 FROM public.tipos_servico s
  WHERE lower(trim(s.nome)) = lower(trim(d.nome))
    AND (s.empresa_id IS NOT DISTINCT FROM d.empresa_id)
);

-- 3) Criar tabela os_servicos (N:N entre OS e tipos_servico)
CREATE TABLE IF NOT EXISTS public.os_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id uuid NOT NULL REFERENCES public.ordens_de_servico(id) ON DELETE CASCADE,
  servico_id uuid REFERENCES public.tipos_servico(id) ON DELETE SET NULL,
  nome text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  categoria text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  empresa_id uuid REFERENCES public.empresas(id)
);

CREATE INDEX IF NOT EXISTS idx_os_servicos_ordem ON public.os_servicos(ordem_id);
CREATE INDEX IF NOT EXISTS idx_os_servicos_servico ON public.os_servicos(servico_id);
CREATE INDEX IF NOT EXISTS idx_os_servicos_empresa ON public.os_servicos(empresa_id);

ALTER TABLE public.os_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa isolada"
  ON public.os_servicos FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE TRIGGER set_empresa_id_os_servicos
  BEFORE INSERT ON public.os_servicos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

-- 4) Dropar os_defeitos (vazia) e tipos_defeito (já migrada)
DROP TABLE IF EXISTS public.os_defeitos;
DROP TABLE IF EXISTS public.tipos_defeito;