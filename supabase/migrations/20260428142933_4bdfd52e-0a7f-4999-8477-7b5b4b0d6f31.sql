-- Consolidar comissão por serviço e ativar triggers operacionais da Etapa 1

CREATE OR REPLACE FUNCTION public.gerar_comissao_automatica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_servico record;
BEGIN
  IF NEW.status::text = 'entregue'
     AND OLD.status::text IS DISTINCT FROM 'entregue'
  THEN
    IF NEW.funcionario_id IS NOT NULL THEN
      FOR v_servico IN
        SELECT id, nome, COALESCE(comissao, 0) AS comissao
        FROM public.os_servicos
        WHERE ordem_id = NEW.id
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
            valor,
            status,
            tipo,
            mes_competencia,
            empresa_id,
            observacoes
          ) VALUES (
            NEW.funcionario_id,
            NEW.id,
            v_servico.id,
            v_servico.comissao,
            'pendente'::public.status_comissao,
            'fixa',
            to_char(now(), 'YYYY-MM'),
            NEW.empresa_id,
            'Serviço: ' || COALESCE(v_servico.nome, 'sem nome')
          );
        END IF;
      END LOOP;
    END IF;

    INSERT INTO public.movimentacoes_financeiras (
      tipo,
      valor,
      descricao,
      ordem_id,
      data,
      empresa_id
    ) VALUES (
      'entrada'::public.tipo_movimentacao,
      COALESCE(NEW.valor_total, 0),
      'Receita OS ' || COALESCE(NEW.numero_formatado, NEW.numero::text),
      NEW.id,
      now(),
      NEW.empresa_id
    );
  END IF;

  IF OLD.status::text = 'entregue'
     AND NEW.status::text IS DISTINCT FROM 'entregue'
  THEN
    UPDATE public.comissoes
    SET status = 'estornada'::public.status_comissao,
        estornada_em = COALESCE(estornada_em, now()),
        updated_at = now()
    WHERE ordem_id = NEW.id
      AND estornada_em IS NULL;

    DELETE FROM public.movimentacoes_financeiras
    WHERE ordem_id = NEW.id
      AND tipo = 'entrada'::public.tipo_movimentacao;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalcular_totais_os_servicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_totais_os(OLD.ordem_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalcular_totais_os(NEW.ordem_id);

  IF TG_OP = 'UPDATE' AND OLD.ordem_id IS DISTINCT FROM NEW.ordem_id THEN
    PERFORM public.recalcular_totais_os(OLD.ordem_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_pecas_utilizadas_baixa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.estoque_itens
  SET quantidade = quantidade - COALESCE(NEW.quantidade, 0)::integer,
      updated_at = now()
  WHERE id = NEW.peca_id;

  PERFORM public.recalcular_totais_os(NEW.ordem_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_pecas_utilizadas_devolver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.estoque_itens
  SET quantidade = quantidade + COALESCE(OLD.quantidade, 0)::integer,
      updated_at = now()
  WHERE id = OLD.peca_id;

  PERFORM public.recalcular_totais_os(OLD.ordem_id);
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_os_atualizar_lucro_bruto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ordens_de_servico
  SET lucro_bruto = COALESCE(NEW.valor_total, 0) - COALESCE(NEW.custo_pecas, 0),
      updated_at = now()
  WHERE id = NEW.id
    AND lucro_bruto IS DISTINCT FROM (COALESCE(NEW.valor_total, 0) - COALESCE(NEW.custo_pecas, 0));

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_os_validar_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text = 'entregue'
     AND OLD.status::text IS DISTINCT FROM 'entregue'
     AND NOT EXISTS (
       SELECT 1
       FROM public.os_servicos
       WHERE ordem_id = NEW.id
     )
  THEN
    RAISE EXCEPTION 'OS deve ter pelo menos um serviço vinculado antes de ser entregue';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_status_entregue ON public.ordens_de_servico;
DROP TRIGGER IF EXISTS trg_ordens_status_entrega_financeiro_comissao ON public.ordens_de_servico;
DROP TRIGGER IF EXISTS trg_comissao_automatica ON public.ordens_de_servico;
DROP TRIGGER IF EXISTS trg_gerar_receita_entrega ON public.ordens_de_servico;
DROP TRIGGER IF EXISTS trg_os_servicos_recalcular ON public.os_servicos;
DROP TRIGGER IF EXISTS trg_pecas_utilizadas_baixa ON public.pecas_utilizadas;
DROP TRIGGER IF EXISTS trg_pecas_utilizadas_devolver ON public.pecas_utilizadas;
DROP TRIGGER IF EXISTS trg_os_atualizar_lucro_bruto ON public.ordens_de_servico;
DROP TRIGGER IF EXISTS trg_os_validar_entrega ON public.ordens_de_servico;

CREATE TRIGGER trg_os_validar_entrega
BEFORE UPDATE OF status ON public.ordens_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.trg_os_validar_entrega();

CREATE TRIGGER trg_os_status_entregue
AFTER UPDATE OF status ON public.ordens_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.gerar_comissao_automatica();

CREATE TRIGGER trg_os_servicos_recalcular
AFTER INSERT OR UPDATE OR DELETE ON public.os_servicos
FOR EACH ROW
EXECUTE FUNCTION public.trg_recalcular_totais_os_servicos();

CREATE TRIGGER trg_pecas_utilizadas_baixa
AFTER INSERT ON public.pecas_utilizadas
FOR EACH ROW
EXECUTE FUNCTION public.trg_pecas_utilizadas_baixa();

CREATE TRIGGER trg_pecas_utilizadas_devolver
AFTER DELETE ON public.pecas_utilizadas
FOR EACH ROW
EXECUTE FUNCTION public.trg_pecas_utilizadas_devolver();

CREATE TRIGGER trg_os_atualizar_lucro_bruto
AFTER UPDATE OF valor_total, custo_pecas ON public.ordens_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.trg_os_atualizar_lucro_bruto();