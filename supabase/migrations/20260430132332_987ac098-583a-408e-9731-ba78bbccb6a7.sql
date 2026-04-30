-- ===== Sessão 1 do FIFO: fundação =====

-- 1) TABELA estoque_lotes
CREATE TABLE IF NOT EXISTS public.estoque_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  peca_id uuid NOT NULL REFERENCES public.estoque_itens(id) ON DELETE CASCADE,
  data_compra date NOT NULL,
  custo_unitario numeric(10,2) NOT NULL CHECK (custo_unitario > 0),
  quantidade_inicial integer NOT NULL CHECK (quantidade_inicial > 0),
  quantidade_disponivel integer NOT NULL,
  origem text NOT NULL CHECK (origem IN ('compra', 'ajuste_manual', 'devolucao_os', 'estoque_inicial')),
  origem_id uuid,
  fornecedor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  observacoes text,
  CONSTRAINT chk_qtd_disponivel_min CHECK (quantidade_disponivel >= 0),
  CONSTRAINT chk_qtd_disponivel_max CHECK (quantidade_disponivel <= quantidade_inicial)
);

CREATE INDEX IF NOT EXISTS idx_lotes_peca_data
  ON public.estoque_lotes (peca_id, data_compra ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_lotes_disponivel
  ON public.estoque_lotes (peca_id) WHERE quantidade_disponivel > 0;
CREATE INDEX IF NOT EXISTS idx_lotes_empresa
  ON public.estoque_lotes (empresa_id);

ALTER TABLE public.estoque_lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lotes — empresa pode ler" ON public.estoque_lotes;
CREATE POLICY "Lotes — empresa pode ler" ON public.estoque_lotes
  FOR SELECT USING (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "Lotes — empresa pode inserir" ON public.estoque_lotes;
CREATE POLICY "Lotes — empresa pode inserir" ON public.estoque_lotes
  FOR INSERT WITH CHECK (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "Lotes — empresa pode atualizar" ON public.estoque_lotes;
CREATE POLICY "Lotes — empresa pode atualizar" ON public.estoque_lotes
  FOR UPDATE USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "Lotes — empresa pode deletar" ON public.estoque_lotes;
CREATE POLICY "Lotes — empresa pode deletar" ON public.estoque_lotes
  FOR DELETE USING (empresa_id = public.get_my_empresa_id());

-- 2) TABELA pecas_utilizadas_lotes
CREATE TABLE IF NOT EXISTS public.pecas_utilizadas_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  peca_utilizada_id uuid NOT NULL REFERENCES public.pecas_utilizadas(id) ON DELETE CASCADE,
  lote_id uuid NOT NULL REFERENCES public.estoque_lotes(id),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  custo_unitario_snapshot numeric(10,2) NOT NULL CHECK (custo_unitario_snapshot >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pul_peca_utilizada ON public.pecas_utilizadas_lotes (peca_utilizada_id);
CREATE INDEX IF NOT EXISTS idx_pul_lote ON public.pecas_utilizadas_lotes (lote_id);
CREATE INDEX IF NOT EXISTS idx_pul_empresa ON public.pecas_utilizadas_lotes (empresa_id);

ALTER TABLE public.pecas_utilizadas_lotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PUL — empresa pode ler" ON public.pecas_utilizadas_lotes;
CREATE POLICY "PUL — empresa pode ler" ON public.pecas_utilizadas_lotes
  FOR SELECT USING (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "PUL — empresa pode inserir" ON public.pecas_utilizadas_lotes;
CREATE POLICY "PUL — empresa pode inserir" ON public.pecas_utilizadas_lotes
  FOR INSERT WITH CHECK (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "PUL — empresa pode deletar" ON public.pecas_utilizadas_lotes;
CREATE POLICY "PUL — empresa pode deletar" ON public.pecas_utilizadas_lotes
  FOR DELETE USING (empresa_id = public.get_my_empresa_id());

-- 3) FUNÇÃO criar_lote_compra
CREATE OR REPLACE FUNCTION public.criar_lote_compra(
  p_peca_id uuid,
  p_quantidade integer,
  p_custo_unitario numeric,
  p_data_compra date,
  p_origem text,
  p_origem_id uuid DEFAULT NULL,
  p_fornecedor_id uuid DEFAULT NULL,
  p_observacoes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lote_id uuid;
  v_empresa_id uuid;
BEGIN
  IF p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade do lote deve ser maior que zero (recebido: %)', p_quantidade;
  END IF;
  IF p_custo_unitario <= 0 THEN
    RAISE EXCEPTION 'Custo unitário do lote deve ser maior que zero. Cadastre o custo real da peça antes de criar o lote.';
  END IF;
  IF p_origem NOT IN ('compra', 'ajuste_manual', 'devolucao_os', 'estoque_inicial') THEN
    RAISE EXCEPTION 'Origem do lote inválida: %. Valores aceitos: compra, ajuste_manual, devolucao_os, estoque_inicial', p_origem;
  END IF;

  SELECT empresa_id INTO v_empresa_id FROM public.estoque_itens WHERE id = p_peca_id;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Peça % não encontrada', p_peca_id;
  END IF;

  INSERT INTO public.estoque_lotes (
    empresa_id, peca_id, data_compra, custo_unitario,
    quantidade_inicial, quantidade_disponivel,
    origem, origem_id, fornecedor_id, observacoes, created_by
  ) VALUES (
    v_empresa_id, p_peca_id, p_data_compra, p_custo_unitario,
    p_quantidade, p_quantidade,
    p_origem, p_origem_id, p_fornecedor_id, p_observacoes, auth.uid()
  )
  RETURNING id INTO v_lote_id;

  RETURN v_lote_id;
END;
$$;

-- 4) FUNÇÃO consumir_estoque_fifo
CREATE OR REPLACE FUNCTION public.consumir_estoque_fifo(
  p_peca_id uuid,
  p_quantidade integer,
  p_lote_id_especifico uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_resultado jsonb := '[]'::jsonb;
  v_falta integer := p_quantidade;
  v_lote record;
  v_pegar integer;
BEGIN
  IF p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade a consumir deve ser positiva (recebido: %)', p_quantidade;
  END IF;

  IF p_lote_id_especifico IS NOT NULL THEN
    SELECT id, quantidade_disponivel, custo_unitario INTO v_lote
      FROM public.estoque_lotes
      WHERE id = p_lote_id_especifico AND peca_id = p_peca_id
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Lote % não encontrado para a peça %', p_lote_id_especifico, p_peca_id;
    END IF;
    IF v_lote.quantidade_disponivel < p_quantidade THEN
      RAISE EXCEPTION 'Lote % tem apenas % unidade(s) disponível(is); solicitado %',
        p_lote_id_especifico, v_lote.quantidade_disponivel, p_quantidade;
    END IF;
    UPDATE public.estoque_lotes
       SET quantidade_disponivel = quantidade_disponivel - p_quantidade,
           updated_at = now()
     WHERE id = v_lote.id;
    v_resultado := jsonb_build_array(jsonb_build_object(
      'lote_id', v_lote.id,
      'quantidade_consumida', p_quantidade,
      'custo_unitario', v_lote.custo_unitario
    ));
    RETURN v_resultado;
  END IF;

  FOR v_lote IN
    SELECT id, quantidade_disponivel, custo_unitario
      FROM public.estoque_lotes
     WHERE peca_id = p_peca_id AND quantidade_disponivel > 0
     ORDER BY data_compra ASC, created_at ASC
     FOR UPDATE
  LOOP
    EXIT WHEN v_falta = 0;
    v_pegar := LEAST(v_lote.quantidade_disponivel, v_falta);
    UPDATE public.estoque_lotes
       SET quantidade_disponivel = quantidade_disponivel - v_pegar,
           updated_at = now()
     WHERE id = v_lote.id;
    v_resultado := v_resultado || jsonb_build_object(
      'lote_id', v_lote.id,
      'quantidade_consumida', v_pegar,
      'custo_unitario', v_lote.custo_unitario
    );
    v_falta := v_falta - v_pegar;
  END LOOP;

  IF v_falta > 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente para a peça %. Falta % unidade(s).', p_peca_id, v_falta;
  END IF;

  RETURN v_resultado;
END;
$$;

-- 5) FUNÇÃO devolver_estoque_lotes
CREATE OR REPLACE FUNCTION public.devolver_estoque_lotes(
  p_peca_utilizada_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pul record;
  v_lote_atual record;
  v_capacidade_restante integer;
  v_pode_voltar integer;
  v_resta integer;
  v_empresa_id uuid;
  v_peca_id uuid;
BEGIN
  SELECT pu.peca_id, pu.empresa_id INTO v_peca_id, v_empresa_id
    FROM public.pecas_utilizadas pu
    WHERE pu.id = p_peca_utilizada_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Peça utilizada % não encontrada', p_peca_utilizada_id;
  END IF;

  FOR v_pul IN
    SELECT pul.id, pul.lote_id, pul.quantidade, pul.custo_unitario_snapshot
      FROM public.pecas_utilizadas_lotes pul
     WHERE pul.peca_utilizada_id = p_peca_utilizada_id
     ORDER BY pul.created_at ASC
  LOOP
    v_resta := v_pul.quantidade;

    SELECT id, quantidade_inicial, quantidade_disponivel, custo_unitario
      INTO v_lote_atual
      FROM public.estoque_lotes
      WHERE id = v_pul.lote_id
      FOR UPDATE;

    IF FOUND THEN
      v_capacidade_restante := v_lote_atual.quantidade_inicial - v_lote_atual.quantidade_disponivel;
      v_pode_voltar := LEAST(v_capacidade_restante, v_resta);
      IF v_pode_voltar > 0 THEN
        UPDATE public.estoque_lotes
           SET quantidade_disponivel = quantidade_disponivel + v_pode_voltar,
               updated_at = now()
         WHERE id = v_lote_atual.id;
        v_resta := v_resta - v_pode_voltar;
      END IF;
    END IF;

    IF v_resta > 0 THEN
      INSERT INTO public.estoque_lotes (
        empresa_id, peca_id, data_compra, custo_unitario,
        quantidade_inicial, quantidade_disponivel,
        origem, origem_id, observacoes, created_by
      ) VALUES (
        v_empresa_id, v_peca_id, current_date, v_pul.custo_unitario_snapshot,
        v_resta, v_resta,
        'devolucao_os', p_peca_utilizada_id,
        'Lote criado por devolução automática (lote original esgotado)',
        auth.uid()
      );
    END IF;
  END LOOP;

  DELETE FROM public.pecas_utilizadas_lotes
   WHERE peca_utilizada_id = p_peca_utilizada_id;
END;
$$;

-- 6) FUNÇÃO calcular_custo_pecas_os
CREATE OR REPLACE FUNCTION public.calcular_custo_pecas_os(
  p_os_id uuid
) RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total numeric := 0;
BEGIN
  SELECT COALESCE(SUM(pul.quantidade * pul.custo_unitario_snapshot), 0)
    INTO v_total
    FROM public.pecas_utilizadas pu
    JOIN public.pecas_utilizadas_lotes pul ON pul.peca_utilizada_id = pu.id
    WHERE pu.ordem_id = p_os_id;
  RETURN v_total;
END;
$$;

-- 7) MIGRATION DE DADOS: 1 lote inicial por peça com qtd > 0
DO $$
DECLARE
  v_peca record;
BEGIN
  FOR v_peca IN
    SELECT id, empresa_id, quantidade, COALESCE(custo_medio, custo_unitario, 0) AS custo, updated_at, created_at
      FROM public.estoque_itens
      WHERE quantidade > 0
        AND deleted_at IS NULL
  LOOP
    IF EXISTS (SELECT 1 FROM public.estoque_lotes WHERE peca_id = v_peca.id) THEN
      CONTINUE;
    END IF;
    IF v_peca.custo <= 0 THEN
      RAISE NOTICE 'Peça % com qtd % e custo zero — pulada na migração.', v_peca.id, v_peca.quantidade;
      CONTINUE;
    END IF;
    INSERT INTO public.estoque_lotes (
      empresa_id, peca_id, data_compra, custo_unitario,
      quantidade_inicial, quantidade_disponivel,
      origem, observacoes
    ) VALUES (
      v_peca.empresa_id,
      v_peca.id,
      COALESCE(v_peca.updated_at::date, v_peca.created_at::date, current_date),
      v_peca.custo,
      v_peca.quantidade,
      v_peca.quantidade,
      'estoque_inicial',
      'Lote criado automaticamente na migração para FIFO em ' || now()::date
    );
  END LOOP;
  RAISE NOTICE 'Migração FIFO concluída.';
END $$;