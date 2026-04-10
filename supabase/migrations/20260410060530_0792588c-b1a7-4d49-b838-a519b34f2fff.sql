
-- Trigger function to auto-create revenue entry when OS is delivered
CREATE OR REPLACE FUNCTION public.gerar_receita_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only when changing TO "entregue" and has a value
  IF NEW.status = 'entregue' AND OLD.status IS DISTINCT FROM 'entregue' AND COALESCE(NEW.valor, 0) > 0 THEN
    INSERT INTO public.movimentacoes_financeiras (tipo, valor, descricao, ordem_id, data)
    VALUES (
      'entrada',
      NEW.valor,
      'Receita OS #' || NEW.numero,
      NEW.id,
      now()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_gerar_receita_entrega ON public.ordens_de_servico;
CREATE TRIGGER trg_gerar_receita_entrega
  AFTER UPDATE ON public.ordens_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_receita_entrega();
