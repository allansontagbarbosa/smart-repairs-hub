-- ============================================================
-- LEVA 1.1 — Trigger BEFORE INSERT para garantir snapshot nunca-null
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
  IF NEW.preco_unitario IS NULL OR NEW.preco_unitario = 0 OR NEW.custo_unitario IS NULL THEN
    SELECT COALESCE(preco_venda, 0), COALESCE(custo_unitario, 0)
      INTO v_preco, v_custo
    FROM public.estoque_itens
    WHERE id = NEW.peca_id;

    IF NEW.preco_unitario IS NULL OR NEW.preco_unitario = 0 THEN
      NEW.preco_unitario := COALESCE(v_preco, 0);
    END IF;
    IF NEW.custo_unitario IS NULL THEN
      NEW.custo_unitario := COALESCE(v_custo, 0);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_pecas_utilizadas ON public.pecas_utilizadas;
CREATE TRIGGER trg_snapshot_pecas_utilizadas
BEFORE INSERT ON public.pecas_utilizadas
FOR EACH ROW EXECUTE FUNCTION public.snapshot_pecas_utilizadas();

-- ============================================================
-- Snapshot para os_servicos: garantir valor + comissao do cadastro
-- ============================================================
CREATE OR REPLACE FUNCTION public.snapshot_os_servicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor numeric;
  v_comissao numeric;
  v_nome text;
  v_categoria text;
BEGIN
  IF NEW.servico_id IS NOT NULL AND (NEW.valor IS NULL OR NEW.valor = 0 OR NEW.comissao IS NULL OR NEW.nome IS NULL) THEN
    SELECT COALESCE(valor_padrao, 0), COALESCE(comissao_padrao, 0), nome, categoria
      INTO v_valor, v_comissao, v_nome, v_categoria
    FROM public.tipos_servico
    WHERE id = NEW.servico_id;

    IF NEW.valor IS NULL OR NEW.valor = 0 THEN NEW.valor := COALESCE(v_valor, 0); END IF;
    IF NEW.comissao IS NULL THEN NEW.comissao := COALESCE(v_comissao, 0); END IF;
    IF NEW.nome IS NULL OR NEW.nome = '' THEN NEW.nome := COALESCE(v_nome, 'Serviço'); END IF;
    IF NEW.categoria IS NULL THEN NEW.categoria := v_categoria; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_os_servicos ON public.os_servicos;
CREATE TRIGGER trg_snapshot_os_servicos
BEFORE INSERT ON public.os_servicos
FOR EACH ROW EXECUTE FUNCTION public.snapshot_os_servicos();

-- ============================================================
-- LEVA 1.2 — Atualiza recalcular_totais_os para fallback ao "valor"
-- legado quando OS não tem itens (pecas_utilizadas + os_servicos vazios).
-- Isso garante que OSs antigas não fiquem com valor_total=0.
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
  v_comissao_total numeric := 0;
  v_mao_obra_adicional numeric := 0;
  v_desconto numeric := 0;
  v_valor_total numeric := 0;
  v_custo_total numeric := 0;
  v_lucro_bruto numeric := 0;
  v_valor_cobrado numeric := 0;
  v_count_servicos int := 0;
  v_count_pecas int := 0;
BEGIN
  SELECT COALESCE(SUM(valor),0), COALESCE(SUM(comissao),0), COUNT(*)
    INTO v_subtotal_servicos, v_comissao_total, v_count_servicos
  FROM public.os_servicos WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(SUM(preco_unitario * quantidade),0),
         COALESCE(SUM(custo_unitario * quantidade),0),
         COUNT(*)
    INTO v_subtotal_pecas, v_custo_pecas, v_count_pecas
  FROM public.pecas_utilizadas WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(mao_obra_adicional,0), COALESCE(desconto,0), COALESCE(valor,0)
    INTO v_mao_obra_adicional, v_desconto, v_valor_cobrado
  FROM public.ordens_de_servico WHERE id = p_ordem_id;

  -- Fallback legado: se OS não tem nenhum item nem mão de obra adicional,
  -- usa o campo "valor" cobrado manualmente como valor_total. Custo fica 0.
  IF v_count_servicos = 0 AND v_count_pecas = 0 AND v_mao_obra_adicional = 0 AND v_valor_cobrado > 0 THEN
    v_valor_total := v_valor_cobrado - v_desconto;
    v_custo_total := 0;
    v_lucro_bruto := v_valor_total;
  ELSE
    v_valor_total := v_subtotal_servicos + v_subtotal_pecas + v_mao_obra_adicional - v_desconto;
    v_custo_total := v_custo_pecas + v_comissao_total;
    v_lucro_bruto := v_valor_total - v_custo_total;
  END IF;

  UPDATE public.ordens_de_servico
  SET valor_total = v_valor_total,
      custo_total = v_custo_total,
      lucro_bruto = v_lucro_bruto,
      custo_pecas = v_custo_pecas
  WHERE id = p_ordem_id;
END;
$$;

-- ============================================================
-- LEVA 1.3 — Migração de dados legados:
-- 1) Backfill snapshots em pecas_utilizadas e os_servicos
-- 2) Recalcular todas as OSs existentes
-- ============================================================

-- Backfill pecas_utilizadas
UPDATE public.pecas_utilizadas pu
SET preco_unitario = COALESCE(NULLIF(pu.preco_unitario,0), ei.preco_venda, 0),
    custo_unitario = COALESCE(NULLIF(pu.custo_unitario,0), ei.custo_unitario, 0)
FROM public.estoque_itens ei
WHERE pu.peca_id = ei.id
  AND (pu.preco_unitario IS NULL OR pu.preco_unitario = 0
       OR pu.custo_unitario IS NULL);

-- Backfill os_servicos
UPDATE public.os_servicos os
SET valor = COALESCE(NULLIF(os.valor,0), ts.valor_padrao, 0),
    comissao = COALESCE(NULLIF(os.comissao,0), ts.comissao_padrao, 0)
FROM public.tipos_servico ts
WHERE os.servico_id = ts.id
  AND (os.valor IS NULL OR os.valor = 0 OR os.comissao IS NULL);

-- Recalcular todas as OSs existentes (uma única vez)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.ordens_de_servico LOOP
    PERFORM public.recalcular_totais_os(r.id);
  END LOOP;
END $$;