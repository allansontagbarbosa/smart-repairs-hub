DROP TRIGGER IF EXISTS trg_ordens_status_entrega_financeiro_comissao ON public.ordens_de_servico;
DROP TRIGGER IF EXISTS trg_os_status_entregue ON public.ordens_de_servico;

CREATE OR REPLACE FUNCTION public.gerar_movimentacao_entrada_os(p_ordem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_os record;
BEGIN
  SELECT
    id,
    numero,
    numero_formatado,
    valor_total,
    empresa_id,
    status,
    deleted_at
  INTO v_os
  FROM public.ordens_de_servico
  WHERE id = p_ordem_id;

  IF v_os.id IS NULL THEN
    RETURN;
  END IF;

  IF v_os.deleted_at IS NOT NULL OR v_os.status::text NOT IN ('pronto', 'entregue') THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.movimentacoes_financeiras
    WHERE ordem_id = p_ordem_id
      AND tipo = 'entrada'::public.tipo_movimentacao
      AND estornada_em IS NULL
    LIMIT 1
  ) THEN
    RETURN;
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
    COALESCE(v_os.valor_total, 0),
    'Receita OS ' || COALESCE(v_os.numero_formatado, v_os.numero::text),
    v_os.id,
    now(),
    v_os.empresa_id
  )
  ON CONFLICT ON CONSTRAINT movimentacoes_financeiras_pkey DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_movimentacao_entrada_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status::text = 'pronto'
     AND OLD.status::text IS DISTINCT FROM 'pronto'
  THEN
    PERFORM public.gerar_movimentacao_entrada_os(NEW.id);
  END IF;

  IF NEW.status::text = 'cancelado'
     AND OLD.status::text IS DISTINCT FROM 'cancelado'
  THEN
    DELETE FROM public.movimentacoes_financeiras
    WHERE ordem_id = NEW.id
      AND tipo = 'entrada'::public.tipo_movimentacao;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_movimentacao_entrada_os ON public.ordens_de_servico;
CREATE TRIGGER trg_movimentacao_entrada_os
AFTER UPDATE OF status ON public.ordens_de_servico
FOR EACH ROW
EXECUTE FUNCTION public.trg_movimentacao_entrada_os();