-- 1) Estornar comissão quando o serviço da OS é removido
CREATE OR REPLACE FUNCTION public.estornar_comissao_servico_removido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.comissoes
  SET status = 'estornada',
      estornada_em = now(),
      updated_at = now()
  WHERE os_servico_id = OLD.id
    AND estornada_em IS NULL
    AND status IN ('pendente', 'liberada');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_estornar_comissao_servico_removido ON public.os_servicos;
CREATE TRIGGER trg_estornar_comissao_servico_removido
BEFORE DELETE ON public.os_servicos
FOR EACH ROW EXECUTE FUNCTION public.estornar_comissao_servico_removido();

-- 2) Backfill: comissões órfãs (serviço já excluído) ainda ativas
UPDATE public.comissoes
SET status = 'estornada',
    estornada_em = now(),
    updated_at = now()
WHERE os_servico_id IS NULL
  AND estornada_em IS NULL
  AND status IN ('pendente', 'liberada')
  AND observacoes LIKE 'Serviço: %';

-- 3) Recalcular totais das OS afetadas
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ordem_id FROM public.comissoes
    WHERE status = 'estornada' AND estornada_em > now() - interval '1 minute' AND ordem_id IS NOT NULL
  LOOP
    PERFORM public.recalcular_totais_os(r.ordem_id);
  END LOOP;
END $$;