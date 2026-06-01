-- 1) Add 'terceirizado' to status enum
ALTER TYPE public.status_ordem ADD VALUE IF NOT EXISTS 'terceirizado';

-- 2) Cadastro de terceiros
CREATE TABLE IF NOT EXISTS public.assistencia_terceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  contato text,
  especialidade text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistencia_terceiros TO authenticated;
GRANT ALL ON public.assistencia_terceiros TO service_role;

ALTER TABLE public.assistencia_terceiros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.assistencia_terceiros;
CREATE POLICY tenant_isolation ON public.assistencia_terceiros
  FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE INDEX IF NOT EXISTS idx_assistencia_terceiros_empresa ON public.assistencia_terceiros(empresa_id) WHERE ativo;

-- 3) Registro de terceirizações
CREATE TABLE IF NOT EXISTS public.assistencia_terceirizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  os_id uuid NOT NULL,
  terceiro_id uuid REFERENCES public.assistencia_terceiros(id) ON DELETE SET NULL,
  terceiro_nome text,
  servico text,
  custo numeric(12,2) NOT NULL DEFAULT 0,
  data_envio date NOT NULL DEFAULT CURRENT_DATE,
  previsao_retorno date,
  data_retorno date,
  status text NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','retornado','cancelado')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistencia_terceirizacoes TO authenticated;
GRANT ALL ON public.assistencia_terceirizacoes TO service_role;

ALTER TABLE public.assistencia_terceirizacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.assistencia_terceirizacoes;
CREATE POLICY tenant_isolation ON public.assistencia_terceirizacoes
  FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE INDEX IF NOT EXISTS idx_assist_terc_os ON public.assistencia_terceirizacoes(os_id);
CREATE INDEX IF NOT EXISTS idx_assist_terc_empresa_status ON public.assistencia_terceirizacoes(empresa_id, status);

-- 4) Atualiza recalcular_totais_os para incluir custo dos terceiros
CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_ordem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_subtotal_servicos numeric := 0;
  v_subtotal_pecas numeric := 0;
  v_custo_pecas numeric := 0;
  v_comissao_servicos_tabela numeric := 0;
  v_mao_obra_adicional numeric := 0;
  v_desconto numeric := 0;
  v_valor_total numeric := 0;
  v_custo_total numeric := 0;
  v_lucro_bruto numeric := 0;
  v_valor_cobrado numeric := 0;
  v_count_servicos int := 0;
  v_count_pecas int := 0;
  v_custo_mao_obra numeric := 0;
  v_custo_terceiros numeric := 0;
  v_margem numeric := 0;
BEGIN
  SELECT COALESCE(SUM(valor), 0), COALESCE(SUM(comissao), 0), COUNT(*)
    INTO v_subtotal_servicos, v_comissao_servicos_tabela, v_count_servicos
    FROM public.os_servicos
    WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(SUM(preco_unitario * quantidade), 0),
         COALESCE(SUM(custo_unitario * quantidade), 0),
         COUNT(*)
    INTO v_subtotal_pecas, v_custo_pecas, v_count_pecas
    FROM public.pecas_utilizadas
    WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(SUM(custo), 0)
    INTO v_custo_terceiros
    FROM public.assistencia_terceirizacoes
    WHERE os_id = p_ordem_id AND status <> 'cancelado';

  SELECT COALESCE(mao_obra_adicional, 0), COALESCE(desconto, 0), COALESCE(valor, 0)
    INTO v_mao_obra_adicional, v_desconto, v_valor_cobrado
    FROM public.ordens_de_servico
    WHERE id = p_ordem_id;

  IF v_count_servicos = 0 AND v_mao_obra_adicional = 0 AND v_valor_cobrado > 0 THEN
    v_valor_total := v_valor_cobrado - v_desconto;
  ELSE
    v_valor_total := v_subtotal_servicos + v_mao_obra_adicional - v_desconto;
  END IF;

  v_custo_mao_obra := v_comissao_servicos_tabela;
  v_custo_total := v_custo_pecas + v_custo_mao_obra + v_custo_terceiros;
  v_lucro_bruto := v_valor_total - v_custo_pecas - v_custo_mao_obra - v_custo_terceiros;

  IF v_valor_total > 0 THEN
    v_margem := (v_lucro_bruto / v_valor_total) * 100;
  END IF;

  UPDATE public.ordens_de_servico
    SET valor_total = v_valor_total,
        valor_total_servicos = v_subtotal_servicos,
        valor_total_pecas = v_subtotal_pecas,
        custo_pecas = v_custo_pecas,
        custo_mao_de_obra = v_custo_mao_obra,
        custo_total = v_custo_total,
        lucro_bruto = v_lucro_bruto,
        margem_calculada = v_margem
    WHERE id = p_ordem_id;
END;
$function$;

-- 5) Trigger para recalcular OS quando a terceirização muda
CREATE OR REPLACE FUNCTION public.trg_assist_terc_recalc_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_totais_os(OLD.os_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalcular_totais_os(NEW.os_id);
  IF TG_OP = 'UPDATE' AND OLD.os_id IS DISTINCT FROM NEW.os_id THEN
    PERFORM public.recalcular_totais_os(OLD.os_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assist_terc_recalc_os ON public.assistencia_terceirizacoes;
CREATE TRIGGER trg_assist_terc_recalc_os
  AFTER INSERT OR UPDATE OR DELETE ON public.assistencia_terceirizacoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_assist_terc_recalc_os();

-- 6) Trigger updated_at
CREATE OR REPLACE FUNCTION public.trg_assist_terc_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_terceiros_updated_at ON public.assistencia_terceiros;
CREATE TRIGGER trg_terceiros_updated_at BEFORE UPDATE ON public.assistencia_terceiros
  FOR EACH ROW EXECUTE FUNCTION public.trg_assist_terc_set_updated_at();

DROP TRIGGER IF EXISTS trg_terceirizacoes_updated_at ON public.assistencia_terceirizacoes;
CREATE TRIGGER trg_terceirizacoes_updated_at BEFORE UPDATE ON public.assistencia_terceirizacoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_assist_terc_set_updated_at();
