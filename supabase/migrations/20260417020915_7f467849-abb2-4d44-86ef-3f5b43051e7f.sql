-- ============================================================
-- LEVA A: Backend Reorganization (Partes 1-4) — corrigido
-- ============================================================

ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS custo_total numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lucro_bruto numeric(10,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.estoque_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  peca_id uuid NOT NULL REFERENCES public.estoque_itens(id) ON DELETE RESTRICT,
  os_id uuid REFERENCES public.ordens_de_servico(id) ON DELETE SET NULL,
  pecas_utilizadas_id uuid REFERENCES public.pecas_utilizadas(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('saida_os','entrada_os','ajuste','compra')),
  quantidade numeric(10,2) NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_peca ON public.estoque_movimentos(peca_id);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_os ON public.estoque_movimentos(os_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_estoque_movimentos_pu_saida
  ON public.estoque_movimentos(pecas_utilizadas_id)
  WHERE tipo = 'saida_os' AND pecas_utilizadas_id IS NOT NULL;

ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa isolada" ON public.estoque_movimentos;
CREATE POLICY "Empresa isolada" ON public.estoque_movimentos
  FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

DROP TRIGGER IF EXISTS set_empresa_id_estoque_movimentos ON public.estoque_movimentos;
CREATE TRIGGER set_empresa_id_estoque_movimentos
  BEFORE INSERT ON public.estoque_movimentos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id();

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
BEGIN
  SELECT COALESCE(SUM(valor),0), COALESCE(SUM(comissao),0)
    INTO v_subtotal_servicos, v_comissao_total
  FROM public.os_servicos WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(SUM(preco_unitario * quantidade),0),
         COALESCE(SUM(custo_unitario * quantidade),0)
    INTO v_subtotal_pecas, v_custo_pecas
  FROM public.pecas_utilizadas WHERE ordem_id = p_ordem_id;

  SELECT COALESCE(mao_obra_adicional,0), COALESCE(desconto,0)
    INTO v_mao_obra_adicional, v_desconto
  FROM public.ordens_de_servico WHERE id = p_ordem_id;

  v_valor_total := v_subtotal_servicos + v_subtotal_pecas + v_mao_obra_adicional - v_desconto;
  v_custo_total := v_custo_pecas + v_comissao_total;
  v_lucro_bruto := v_valor_total - v_custo_total;

  UPDATE public.ordens_de_servico
  SET valor_total = v_valor_total,
      custo_total = v_custo_total,
      lucro_bruto = v_lucro_bruto,
      custo_pecas = v_custo_pecas
  WHERE id = p_ordem_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalcular_totais_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ordem_id uuid;
BEGIN
  v_ordem_id := COALESCE(NEW.ordem_id, OLD.ordem_id);
  IF v_ordem_id IS NOT NULL THEN
    PERFORM public.recalcular_totais_os(v_ordem_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_os_pecas ON public.pecas_utilizadas;
CREATE TRIGGER trg_recalc_os_pecas
  AFTER INSERT OR UPDATE OR DELETE ON public.pecas_utilizadas
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_totais_os();

DROP TRIGGER IF EXISTS trg_recalc_os_servicos ON public.os_servicos;
CREATE TRIGGER trg_recalc_os_servicos
  AFTER INSERT OR UPDATE OR DELETE ON public.os_servicos
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_totais_os();

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
  ) THEN
    PERFORM public.recalcular_totais_os(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_os_self ON public.ordens_de_servico;
CREATE TRIGGER trg_recalc_os_self
  AFTER UPDATE OF mao_obra_adicional, desconto ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_os_self();

CREATE OR REPLACE FUNCTION public.trg_baixa_estoque_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pu record;
  v_status_destino text[] := ARRAY['pronto','entregue'];
  v_status_cancela text[] := ARRAY['cancelado'];
BEGIN
  IF NEW.status::text = ANY(v_status_destino)
     AND (OLD.status::text IS DISTINCT FROM NEW.status::text)
     AND NOT (OLD.status::text = ANY(v_status_destino))
  THEN
    FOR v_pu IN
      SELECT id, peca_id, quantidade, empresa_id
      FROM public.pecas_utilizadas WHERE ordem_id = NEW.id
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.estoque_movimentos
        WHERE pecas_utilizadas_id = v_pu.id AND tipo = 'saida_os'
      ) THEN
        INSERT INTO public.estoque_movimentos (empresa_id, peca_id, os_id, pecas_utilizadas_id, tipo, quantidade, motivo)
        VALUES (v_pu.empresa_id, v_pu.peca_id, NEW.id, v_pu.id, 'saida_os', v_pu.quantidade, 'OS #' || NEW.numero || ' - baixa automatica');

        UPDATE public.estoque_itens
        SET quantidade = GREATEST(0, quantidade - v_pu.quantidade::int)
        WHERE id = v_pu.peca_id;
      END IF;
    END LOOP;
  END IF;

  IF NEW.status::text = ANY(v_status_cancela)
     AND OLD.status::text = ANY(v_status_destino)
  THEN
    FOR v_pu IN
      SELECT id, peca_id, quantidade, empresa_id
      FROM public.pecas_utilizadas WHERE ordem_id = NEW.id
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.estoque_movimentos
        WHERE pecas_utilizadas_id = v_pu.id AND tipo = 'saida_os'
      ) AND NOT EXISTS (
        SELECT 1 FROM public.estoque_movimentos
        WHERE pecas_utilizadas_id = v_pu.id AND tipo = 'entrada_os'
      ) THEN
        INSERT INTO public.estoque_movimentos (empresa_id, peca_id, os_id, pecas_utilizadas_id, tipo, quantidade, motivo)
        VALUES (v_pu.empresa_id, v_pu.peca_id, NEW.id, v_pu.id, 'entrada_os', v_pu.quantidade, 'OS #' || NEW.numero || ' - cancelamento, devolucao');

        UPDATE public.estoque_itens
        SET quantidade = quantidade + v_pu.quantidade::int
        WHERE id = v_pu.peca_id;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_baixa_estoque_os ON public.ordens_de_servico;
CREATE TRIGGER trg_baixa_estoque_os
  AFTER UPDATE OF status ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.trg_baixa_estoque_os();

CREATE OR REPLACE FUNCTION public.trg_devolver_peca_removida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.estoque_movimentos
    WHERE pecas_utilizadas_id = OLD.id AND tipo = 'saida_os'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.estoque_movimentos
    WHERE pecas_utilizadas_id = OLD.id AND tipo = 'entrada_os'
  ) THEN
    INSERT INTO public.estoque_movimentos (empresa_id, peca_id, os_id, pecas_utilizadas_id, tipo, quantidade, motivo)
    VALUES (OLD.empresa_id, OLD.peca_id, OLD.ordem_id, OLD.id, 'entrada_os', OLD.quantidade, 'Peca removida da OS, devolucao automatica');

    UPDATE public.estoque_itens
    SET quantidade = quantidade + OLD.quantidade::int
    WHERE id = OLD.peca_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_devolver_peca_removida ON public.pecas_utilizadas;
CREATE TRIGGER trg_devolver_peca_removida
  AFTER DELETE ON public.pecas_utilizadas
  FOR EACH ROW EXECUTE FUNCTION public.trg_devolver_peca_removida();

-- ─── MIGRAÇÃO DE LEGADOS ───
UPDATE public.pecas_utilizadas pu
SET preco_unitario = COALESCE(NULLIF(pu.preco_unitario,0), ei.preco_venda, 0),
    custo_unitario = COALESCE(NULLIF(pu.custo_unitario,0), ei.custo_unitario, 0)
FROM public.estoque_itens ei
WHERE pu.peca_id = ei.id
  AND (pu.preco_unitario = 0 OR pu.custo_unitario = 0);

UPDATE public.os_servicos os
SET valor = COALESCE(NULLIF(os.valor,0), ts.valor_padrao, 0),
    comissao = COALESCE(NULLIF(os.comissao,0), ts.comissao_padrao, 0)
FROM public.tipos_servico ts
WHERE os.servico_id = ts.id
  AND (os.valor = 0 OR os.comissao = 0);

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.ordens_de_servico WHERE deleted_at IS NULL LOOP
    PERFORM public.recalcular_totais_os(r.id);
  END LOOP;
END $$;