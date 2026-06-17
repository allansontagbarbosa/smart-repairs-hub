-- ATACADO-CAD-06: remove CHECK constraints rígidas das colunas alimentadas por catálogos editáveis.
-- A validade passa a ser garantida pelos catálogos (atacado_condicoes, atacado_status_aparelho, atacado_grades) + UI.

ALTER TABLE public.atacado_aparelhos
  DROP CONSTRAINT IF EXISTS atacado_aparelhos_condicao_check;

ALTER TABLE public.atacado_aparelhos
  DROP CONSTRAINT IF EXISTS atacado_aparelhos_status_check;

ALTER TABLE public.atacado_aparelhos
  DROP CONSTRAINT IF EXISTS atacado_aparelhos_grade_check;
