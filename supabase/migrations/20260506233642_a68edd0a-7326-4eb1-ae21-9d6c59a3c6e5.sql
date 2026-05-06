-- Enums
CREATE TYPE public.metric_meta AS ENUM (
  'faturamento',
  'qtd_os',
  'qtd_servicos',
  'ticket_medio',
  'comissao_paga',
  'margem_os',
  'tempo_medio_horas',
  'retrabalho_taxa',
  'aprovacao_orcamento_taxa',
  'retorno_cliente_30d'
);

CREATE TYPE public.escopo_meta AS ENUM ('empresa', 'tecnico', 'loja');

CREATE TYPE public.status_meta AS ENUM (
  'ativa',
  'pausada',
  'concluida_sucesso',
  'concluida_falha'
);

-- Tabela
CREATE TABLE public.metas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  descricao text,
  metrica public.metric_meta NOT NULL,
  sentido text NOT NULL DEFAULT 'maior' CHECK (sentido IN ('maior', 'menor')),
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  CONSTRAINT periodo_valido CHECK (periodo_fim >= periodo_inicio),
  escopo public.escopo_meta NOT NULL,
  escopo_id uuid,
  CONSTRAINT escopo_id_consistente CHECK (
    (escopo = 'empresa' AND escopo_id IS NULL) OR
    (escopo IN ('tecnico', 'loja') AND escopo_id IS NOT NULL)
  ),
  valor_alvo numeric NOT NULL CHECK (valor_alvo > 0),
  valor_atual numeric NOT NULL DEFAULT 0,
  threshold_atencao int NOT NULL DEFAULT 50 CHECK (threshold_atencao BETWEEN 0 AND 100),
  threshold_alerta int NOT NULL DEFAULT 80 CHECK (threshold_alerta BETWEEN 0 AND 100),
  CONSTRAINT thresholds_ordenados CHECK (threshold_atencao <= threshold_alerta),
  status public.status_meta NOT NULL DEFAULT 'ativa',
  concluida_em timestamptz,
  deleted_at timestamptz
);

CREATE INDEX idx_metas_empresa_status ON public.metas(empresa_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_metas_periodo ON public.metas(empresa_id, periodo_inicio, periodo_fim) WHERE deleted_at IS NULL;
CREATE INDEX idx_metas_escopo ON public.metas(empresa_id, escopo, escopo_id) WHERE deleted_at IS NULL;

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADM e usuários autenticados leem metas da empresa"
  ON public.metas FOR SELECT
  TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

CREATE POLICY "ADM cria metas"
  ON public.metas FOR INSERT
  TO authenticated
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE POLICY "ADM atualiza metas"
  ON public.metas FOR UPDATE
  TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE POLICY "ADM faz soft delete de metas"
  ON public.metas FOR DELETE
  TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

COMMENT ON TABLE public.metas IS 'Metas configuráveis por empresa, técnico ou loja. Progresso calculado on-demand pela RPC calcular_progresso_meta.';
COMMENT ON COLUMN public.metas.sentido IS '"maior": valor maior é melhor (faturamento). "menor": valor menor é melhor (retrabalho).';
COMMENT ON COLUMN public.metas.escopo_id IS 'funcionario_id quando escopo=tecnico, loja_id quando escopo=loja, NULL quando escopo=empresa.';
COMMENT ON COLUMN public.metas.valor_atual IS 'Cache do progresso. Atualizado pela RPC calcular_progresso_meta. Valor canônico vem da RPC.';