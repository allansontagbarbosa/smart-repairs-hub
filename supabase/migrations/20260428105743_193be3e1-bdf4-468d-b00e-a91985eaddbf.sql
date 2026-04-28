-- RESET ARQUITETURAL ETAPA 1: triggers e comissão por serviço

-- 1) Suporte a estorno financeiro e vínculo da comissão ao serviço da OS
ALTER TABLE public.movimentacoes_financeiras
  ADD COLUMN IF NOT EXISTS estornada_em TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.comissoes
  ADD COLUMN IF NOT EXISTS os_servico_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comissoes_os_servico_id_fkey'
      AND conrelid = 'public.comissoes'::regclass
  ) THEN
    ALTER TABLE public.comissoes
      ADD CONSTRAINT comissoes_os_servico_id_fkey
      FOREIGN KEY (os_servico_id)
      REFERENCES public.os_servicos(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_comissoes_os_servico_ativa
  ON public.comissoes (ordem_id, os_servico_id, funcionario_id)
  WHERE estornada_em IS NULL AND os_servico_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mov_fin_os_entrada_ativa
  ON public.movimentacoes_financeiras (ordem_id, tipo)
  WHERE tipo = 'entrada'::public.tipo_movimentacao
    AND ordem_id IS NOT NULL
    AND estornada_em IS NULL;

-- 2) Recálculo alinhado ao modelo: serviço é receita, peça é custo, comissão vem de os_servicos.comissao
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
  v_custo_total := v_custo_pecas + v_custo_mao_obra;
  v_lucro_bruto := v_valor_total - v_custo_pecas;

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

-- 3) Trigger function genérica para recálculo em os_servicos, pecas_utilizadas e ordens_de_servico
CREATE OR REPLACE FUNCTION public.trg_recalcular_totais_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ordem_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'ordens_de_servico' THEN
    v_ordem_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_ordem_id := COALESCE(NEW.ordem_id, OLD.ordem_id);
  END IF;

  IF v_ordem_id IS NOT NULL THEN
    PERFORM public.recalcular_totais_os(v_ordem_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 4) Baixa de estoque também ao inserir peça utilizada; mantém compatibilidade com uso em status de OS
CREATE OR REPLACE FUNCTION public.trg_baixa_estoque_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pu record;
  v_status_destino text[] := ARRAY['pronto', 'entregue'];
  v_status_cancela text[] := ARRAY['cancelado'];
BEGIN
  IF TG_TABLE_NAME = 'pecas_utilizadas' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.estoque_movimentos
      WHERE pecas_utilizadas_id = NEW.id AND tipo = 'saida_os'
    ) THEN
      INSERT INTO public.estoque_movimentos (empresa_id, peca_id, os_id, pecas_utilizadas_id, tipo, quantidade, motivo)
      VALUES (NEW.empresa_id, NEW.peca_id, NEW.ordem_id, NEW.id, 'saida_os', NEW.quantidade, 'Baixa automatica por uso em OS');

      UPDATE public.estoque_itens
      SET quantidade = quantidade - NEW.quantidade::int
      WHERE id = NEW.peca_id;
    END IF;

    PERFORM public.recalcular_totais_os(NEW.ordem_id);
    RETURN NEW;
  END IF;

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
        SET quantidade = quantidade - v_pu.quantidade::int
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
$function$;

-- 5) Devolução de peça removida + recálculo automático
CREATE OR REPLACE FUNCTION public.trg_devolver_peca_removida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  PERFORM public.recalcular_totais_os(OLD.ordem_id);
  RETURN OLD;
END;
$function$;

-- 6) Validação de entrega: OS entregue precisa ter valor e ao menos um serviço
CREATE OR REPLACE FUNCTION public.validar_entrega_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tem_servico boolean;
BEGIN
  IF NEW.status::text = 'entregue' AND OLD.status::text IS DISTINCT FROM NEW.status::text THEN
    SELECT EXISTS (
      SELECT 1 FROM public.os_servicos WHERE ordem_id = NEW.id
    ) INTO v_tem_servico;

    IF COALESCE(NEW.valor_total, 0) <= 0 OR NOT v_tem_servico THEN
      RAISE EXCEPTION 'OS não pode ser entregue sem valor_total positivo e pelo menos um serviço vinculado';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 7) Comissão automática por serviço + movimentação financeira na entrega/estorno
CREATE OR REPLACE FUNCTION public.gerar_comissao_automatica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_servico record;
  v_mes_competencia text;
BEGIN
  IF NEW.status::text = 'entregue' AND OLD.status::text IS DISTINCT FROM 'entregue' THEN
    v_mes_competencia := to_char(COALESCE(NEW.data_conclusao, NEW.data_entrega, now()), 'YYYY-MM');

    IF NEW.funcionario_id IS NOT NULL THEN
      FOR v_servico IN
        SELECT id, nome, comissao
        FROM public.os_servicos
        WHERE ordem_id = NEW.id
          AND COALESCE(comissao, 0) > 0
      LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM public.comissoes
          WHERE ordem_id = NEW.id
            AND os_servico_id = v_servico.id
            AND funcionario_id = NEW.funcionario_id
            AND estornada_em IS NULL
        ) THEN
          INSERT INTO public.comissoes (
            funcionario_id,
            ordem_id,
            os_servico_id,
            empresa_id,
            valor,
            valor_base,
            tipo,
            status,
            observacoes,
            mes_competencia
          ) VALUES (
            NEW.funcionario_id,
            NEW.id,
            v_servico.id,
            NEW.empresa_id,
            v_servico.comissao,
            NULL,
            'fixa',
            'pendente',
            'Serviço: ' || v_servico.nome,
            v_mes_competencia
          );
        END IF;
      END LOOP;
    END IF;

    IF COALESCE(NEW.valor_total, 0) > 0
       AND NOT EXISTS (
         SELECT 1
         FROM public.movimentacoes_financeiras
         WHERE ordem_id = NEW.id
           AND tipo = 'entrada'::public.tipo_movimentacao
           AND estornada_em IS NULL
       ) THEN
      INSERT INTO public.movimentacoes_financeiras (
        tipo,
        descricao,
        valor,
        ordem_id,
        empresa_id,
        data
      ) VALUES (
        'entrada'::public.tipo_movimentacao,
        'Recebimento OS #' || COALESCE(NEW.numero_formatado, NEW.numero::text),
        NEW.valor_total,
        NEW.id,
        NEW.empresa_id,
        COALESCE(NEW.data_entrega, now())
      );
    END IF;
  END IF;

  IF OLD.status::text = 'entregue' AND NEW.status::text IS DISTINCT FROM 'entregue' THEN
    UPDATE public.comissoes
    SET status = 'estornada'::public.status_comissao,
        estornada_em = COALESCE(estornada_em, now()),
        updated_at = now()
    WHERE ordem_id = NEW.id
      AND estornada_em IS NULL;

    UPDATE public.movimentacoes_financeiras
    SET estornada_em = COALESCE(estornada_em, now())
    WHERE ordem_id = NEW.id
      AND tipo = 'entrada'::public.tipo_movimentacao
      AND estornada_em IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- 8) Recriação idempotente dos triggers críticos
DROP TRIGGER IF EXISTS trg_validar_entrega_os_before_status ON public.ordens_de_servico;
DROP TRIGGER IF EXISTS trg_ordens_status_entrega_financeiro_comissao ON public.ordens_de_servico;
DROP TRIGGER IF EXISTS trg_os_servicos_recalcular_totais ON public.os_servicos;
DROP TRIGGER IF EXISTS trg_pecas_utilizadas_baixa_estoque_recalcular_ins ON public.pecas_utilizadas;
DROP TRIGGER IF EXISTS trg_pecas_utilizadas_devolver_estoque_recalcular_del ON public.pecas_utilizadas;
DROP TRIGGER IF EXISTS trg_ordens_recalcular_totais_valores ON public.ordens_de_servico;

CREATE TRIGGER trg_validar_entrega_os_before_status
BEFORE UPDATE OF status ON public.ordens_de_servico
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.validar_entrega_os();

CREATE TRIGGER trg_ordens_status_entrega_financeiro_comissao
AFTER UPDATE OF status ON public.ordens_de_servico
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.gerar_comissao_automatica();

CREATE TRIGGER trg_os_servicos_recalcular_totais
AFTER INSERT OR UPDATE OR DELETE ON public.os_servicos
FOR EACH ROW
EXECUTE FUNCTION public.trg_recalcular_totais_os();

CREATE TRIGGER trg_pecas_utilizadas_baixa_estoque_recalcular_ins
AFTER INSERT ON public.pecas_utilizadas
FOR EACH ROW
EXECUTE FUNCTION public.trg_baixa_estoque_os();

CREATE TRIGGER trg_pecas_utilizadas_devolver_estoque_recalcular_del
AFTER DELETE ON public.pecas_utilizadas
FOR EACH ROW
EXECUTE FUNCTION public.trg_devolver_peca_removida();

CREATE TRIGGER trg_ordens_recalcular_totais_valores
AFTER UPDATE OF valor_total, custo_pecas, desconto ON public.ordens_de_servico
FOR EACH ROW
WHEN (
  NEW.valor_total IS DISTINCT FROM OLD.valor_total
  OR NEW.custo_pecas IS DISTINCT FROM OLD.custo_pecas
  OR NEW.desconto IS DISTINCT FROM OLD.desconto
)
EXECUTE FUNCTION public.trg_recalcular_totais_os();