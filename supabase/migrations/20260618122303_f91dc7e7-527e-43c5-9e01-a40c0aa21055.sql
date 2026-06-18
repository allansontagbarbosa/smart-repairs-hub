-- ATACADO-CAD-06: garantir remoção das CHECKs rígidas em colunas de catálogo editável no atacado.
-- Idempotente: DROP IF EXISTS. Catálogos (atacado_condicoes, atacado_status_aparelho, atacado_grades) + UI garantem integridade.

ALTER TABLE public.atacado_aparelhos DROP CONSTRAINT IF EXISTS atacado_aparelhos_condicao_check;
ALTER TABLE public.atacado_aparelhos DROP CONSTRAINT IF EXISTS atacado_aparelhos_status_check;
ALTER TABLE public.atacado_aparelhos DROP CONSTRAINT IF EXISTS atacado_aparelhos_grade_check;
ALTER TABLE public.atacado_aparelhos DROP CONSTRAINT IF EXISTS atacado_aparelhos_marca_check;