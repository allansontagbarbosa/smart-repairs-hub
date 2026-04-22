-- ============================================================
-- 1. Custo médio ponderado por peça
-- ============================================================
ALTER TABLE public.estoque_itens
  ADD COLUMN IF NOT EXISTS custo_medio NUMERIC(12, 4) NOT NULL DEFAULT 0;

-- Inicializa custo_medio com custo_unitario atual (compatibilidade retroativa)
UPDATE public.estoque_itens
  SET custo_medio = COALESCE(custo_unitario, 0)
  WHERE custo_medio = 0 AND COALESCE(custo_unitario, 0) > 0;

-- ============================================================
-- 2. Comissão tipada do funcionário
-- ============================================================
-- Tipo enum tipo_comissao só tem 'fixa'/'percentual'. Adiciona valores novos.
ALTER TYPE public.tipo_comissao ADD VALUE IF NOT EXISTS 'fixo_por_os';
ALTER TYPE public.tipo_comissao ADD VALUE IF NOT EXISTS 'percentual_lucro';

-- ============================================================
-- 3. Campos de lucro detalhado em ordens_de_servico
-- (lucro_bruto e custo_total já existem; adicionamos detalhamento e margem)
-- ============================================================
ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS valor_total_servicos NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_total_pecas NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_mao_de_obra NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margem_calculada NUMERIC(7, 2) NOT NULL DEFAULT 0;

-- ============================================================
-- 4. Histórico de mudanças de custo médio
-- ============================================================
CREATE TABLE IF NOT EXISTS public.historico_custo_peca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  peca_id UUID NOT NULL REFERENCES public.estoque_itens(id) ON DELETE CASCADE,
  custo_anterior NUMERIC(12, 4),
  custo_novo NUMERIC(12, 4) NOT NULL,
  quantidade_anterior NUMERIC(12, 2),
  quantidade_movimentada NUMERIC(12, 2),
  preco_compra_unitario NUMERIC(12, 4),
  origem TEXT NOT NULL CHECK (origem IN ('compra_formal','entrada_direta','ajuste_inicial','ajuste_manual')),
  origem_id UUID,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  registrado_por UUID
);

CREATE INDEX IF NOT EXISTS idx_historico_custo_peca_peca
  ON public.historico_custo_peca(peca_id, registrado_em DESC);
CREATE INDEX IF NOT EXISTS idx_historico_custo_peca_empresa
  ON public.historico_custo_peca(empresa_id, registrado_em DESC);

ALTER TABLE public.historico_custo_peca ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa isolada" ON public.historico_custo_peca;
CREATE POLICY "Empresa isolada"
  ON public.historico_custo_peca
  FOR ALL
  TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

-- Auto-preencher empresa_id
DROP TRIGGER IF EXISTS set_empresa_id_historico_custo ON public.historico_custo_peca;
CREATE TRIGGER set_empresa_id_historico_custo
  BEFORE INSERT ON public.historico_custo_peca
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

-- ============================================================
-- 5. Função: recalcular custo médio ponderado
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalcular_custo_medio(
  p_peca_id UUID,
  p_quantidade_entrada NUMERIC,
  p_preco_compra_unitario NUMERIC,
  p_origem TEXT,
  p_origem_id UUID DEFAULT NULL
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estoque_atual NUMERIC;
  v_custo_atual NUMERIC;
  v_novo_custo NUMERIC;
  v_empresa_id UUID;
BEGIN
  SELECT quantidade, COALESCE(custo_medio, 0), empresa_id
    INTO v_estoque_atual, v_custo_atual, v_empresa_id
    FROM public.estoque_itens
    WHERE id = p_peca_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Peça % não encontrada', p_peca_id;
  END IF;

  IF (v_estoque_atual + p_quantidade_entrada) > 0 THEN
    v_novo_custo := (
      (v_estoque_atual * v_custo_atual)
      + (p_quantidade_entrada * p_preco_compra_unitario)
    ) / (v_estoque_atual + p_quantidade_entrada);
  ELSE
    v_novo_custo := p_preco_compra_unitario;
  END IF;

  UPDATE public.estoque_itens
    SET quantidade = quantidade + p_quantidade_entrada::int,
        custo_medio = v_novo_custo,
        custo_unitario = v_novo_custo,
        updated_at = now()
    WHERE id = p_peca_id;

  INSERT INTO public.historico_custo_peca (
    empresa_id, peca_id, custo_anterior, custo_novo,
    quantidade_anterior, quantidade_movimentada, preco_compra_unitario,
    origem, origem_id, registrado_por
  ) VALUES (
    v_empresa_id, p_peca_id, v_custo_atual, v_novo_custo,
    v_estoque_atual, p_quantidade_entrada, p_preco_compra_unitario,
    p_origem, p_origem_id, auth.uid()
  );

  RETURN v_novo_custo;
END;
$$;

-- ============================================================
-- 6. Atualizar snapshot de pecas_utilizadas para usar custo_medio
-- ============================================================
CREATE OR REPLACE FUNCTION public.snapshot_pecas_utilizadas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preco numeric;
  v_custo numeric;
BEGIN
  IF NEW.preco_unitario IS NULL OR NEW.preco_unitario = 0 OR NEW.custo_unitario IS NULL OR NEW.custo_unitario = 0 THEN
    SELECT COALESCE(preco_venda, 0), COALESCE(custo_medio, custo_unitario, 0)
      INTO v_preco, v_custo
    FROM public.estoque_itens
    WHERE id = NEW.peca_id;

    IF NEW.preco_unitario IS NULL OR NEW.preco_unitario = 0 THEN
      NEW.preco_unitario := COALESCE(v_preco, 0);
    END IF;
    IF NEW.custo_unitario IS NULL OR NEW.custo_unitario = 0 THEN
      NEW.custo_unitario := COALESCE(v_custo, 0);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 7. Estender recalcular_totais_os para incluir comissão tipada do técnico
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_ordem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_funcionario_id uuid;
  v_tipo_comissao text;
  v_valor_comissao numeric := 0;
  v_custo_mao_obra numeric := 0;
  v_margem numeric := 0;
BEGIN
  SELECT COALESCE(SUM(valor),0), COALESCE(SUM(comissao),0), COUNT(*)
    INTO v_subtotal_servicos, v_comissao_servicos_tabela, v_count_servicos
    FROM public.os_servicos WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(SUM(preco_unitario * quantidade),0),
         COALESCE(SUM(custo_unitario * quantidade),0),
         COUNT(*)
    INTO v_subtotal_pecas, v_custo_pecas, v_count_pecas
    FROM public.pecas_utilizadas WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(mao_obra_adicional,0), COALESCE(desconto,0), COALESCE(valor,0), funcionario_id
    INTO v_mao_obra_adicional, v_desconto, v_valor_cobrado, v_funcionario_id
    FROM public.ordens_de_servico WHERE id = p_ordem_id;

  -- Fallback legado
  IF v_count_servicos = 0 AND v_count_pecas = 0 AND v_mao_obra_adicional = 0 AND v_valor_cobrado > 0 THEN
    v_valor_total := v_valor_cobrado - v_desconto;
  ELSE
    v_valor_total := v_subtotal_servicos + v_subtotal_pecas + v_mao_obra_adicional - v_desconto;
  END IF;

  -- Comissão tipada do técnico (apenas se a OS estiver vinculada a um funcionário)
  IF v_funcionario_id IS NOT NULL THEN
    SELECT tipo_comissao::text, COALESCE(valor_comissao, 0)
      INTO v_tipo_comissao, v_valor_comissao
      FROM public.funcionarios
      WHERE id = v_funcionario_id;

    IF v_tipo_comissao IS NOT NULL AND v_valor_comissao > 0 THEN
      v_custo_mao_obra := CASE v_tipo_comissao
        WHEN 'percentual'        THEN v_valor_total * (v_valor_comissao / 100)
        WHEN 'fixa'              THEN v_valor_comissao
        WHEN 'fixo_por_os'       THEN v_valor_comissao
        WHEN 'percentual_lucro'  THEN GREATEST(0, v_valor_total - v_custo_pecas) * (v_valor_comissao / 100)
        ELSE 0
      END;
    END IF;
  END IF;

  -- Se não houver comissão tipada, mas a tabela os_servicos trouxer comissão fixa, usa essa
  IF v_custo_mao_obra = 0 AND v_comissao_servicos_tabela > 0 THEN
    v_custo_mao_obra := v_comissao_servicos_tabela;
  END IF;

  v_custo_total := v_custo_pecas + v_custo_mao_obra;
  v_lucro_bruto := v_valor_total - v_custo_total;

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
$$;

-- ============================================================
-- 8. Garantir que mudança de funcionário recalcula a OS
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_recalc_os_self()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE') AND (
    COALESCE(OLD.mao_obra_adicional,0) IS DISTINCT FROM COALESCE(NEW.mao_obra_adicional,0)
    OR COALESCE(OLD.desconto,0) IS DISTINCT FROM COALESCE(NEW.desconto,0)
    OR COALESCE(OLD.valor,0) IS DISTINCT FROM COALESCE(NEW.valor,0)
    OR COALESCE(OLD.funcionario_id::text,'') IS DISTINCT FROM COALESCE(NEW.funcionario_id::text,'')
  ) THEN
    PERFORM public.recalcular_totais_os(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;