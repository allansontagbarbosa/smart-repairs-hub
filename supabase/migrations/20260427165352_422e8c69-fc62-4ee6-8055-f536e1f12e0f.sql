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
$$;