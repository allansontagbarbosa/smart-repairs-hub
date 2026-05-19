BEGIN;
DROP POLICY IF EXISTS "Empresa isolada" ON public.funcionarios;
DROP POLICY IF EXISTS "Empresa isolada" ON public.comissoes;
DROP POLICY IF EXISTS "Empresa isolada" ON public.socios;
COMMIT;