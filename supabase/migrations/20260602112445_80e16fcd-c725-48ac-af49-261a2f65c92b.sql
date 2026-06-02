CREATE OR REPLACE FUNCTION public.valida_aguardando_peca()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'aguardando_peca'
     AND COALESCE(OLD.status::text,'') <> 'aguardando_peca' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pecas_utilizadas pu WHERE pu.ordem_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Defina ao menos uma peça (em peças utilizadas) antes de marcar a OS como aguardando peça';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_valida_aguardando_peca ON public.ordens_de_servico;
CREATE TRIGGER trg_valida_aguardando_peca
  BEFORE UPDATE ON public.ordens_de_servico
  FOR EACH ROW EXECUTE FUNCTION public.valida_aguardando_peca();

CREATE OR REPLACE FUNCTION public.os_aguardando_sem_peca()
RETURNS TABLE (os_id uuid, numero bigint, cliente text, aparelho text, desde date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.id AS os_id,
    o.numero::bigint AS numero,
    c.nome AS cliente,
    TRIM(CONCAT_WS(' ', a.marca, a.modelo)) AS aparelho,
    o.pecas_pedido_em AS desde
  FROM public.ordens_de_servico o
  LEFT JOIN public.aparelhos a ON a.id = o.aparelho_id
  LEFT JOIN public.clientes c ON c.id = a.cliente_id
  WHERE o.empresa_id = public.get_my_empresa_id()
    AND o.deleted_at IS NULL
    AND o.status = 'aguardando_peca'
    AND NOT EXISTS (SELECT 1 FROM public.pecas_utilizadas pu WHERE pu.ordem_id = o.id)
  ORDER BY o.pecas_pedido_em NULLS FIRST;
$$;

GRANT EXECUTE ON FUNCTION public.os_aguardando_sem_peca() TO authenticated;