-- Backfill: corrigir os_servicos com valor=0 que tem tipo_servico com valor_padrao>0
-- Causa raíz: os serviços foram inseridos antes do tipos_servico ter valor_padrao definido
-- O trigger snapshot_os_servicos funciona corretamente, mas só roda no INSERT inicial.

UPDATE public.os_servicos os
SET
  valor = COALESCE(NULLIF(os.valor, 0), ts.valor_padrao, 0),
  comissao = COALESCE(NULLIF(os.comissao, 0), ts.comissao_padrao, 0),
  nome = COALESCE(NULLIF(os.nome, ''), ts.nome, 'Serviço'),
  categoria = COALESCE(os.categoria, ts.categoria)
FROM public.tipos_servico ts
WHERE os.servico_id = ts.id
  AND (os.valor IS NULL OR os.valor = 0)
  AND ts.valor_padrao > 0;

-- Recalcular totais de todas as OSs que tiveram serviços corrigidos
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ordem_id
    FROM public.os_servicos
    WHERE valor > 0
  LOOP
    PERFORM public.recalcular_totais_os(r.ordem_id);
  END LOOP;
END $$;