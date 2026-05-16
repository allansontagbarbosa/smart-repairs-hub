BEGIN;

DROP FUNCTION IF EXISTS public.get_dashboard_operacional() CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_bancadas() CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_contadores_status() CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_caixa_hoje() CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_lucro_mes() CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_estoque_resumo() CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_ranking_mes() CASCADE;

DROP TABLE IF EXISTS public.metas_tecnico_mensais CASCADE;

DROP TABLE IF EXISTS public.escritorio_moveis_posicionados CASCADE;
DROP TABLE IF EXISTS public.escritorio_layouts CASCADE;
DROP TABLE IF EXISTS public.escritorio_catalogo_moveis CASCADE;

DROP FUNCTION IF EXISTS public.fn_escritorio_atualizar_updated_at() CASCADE;

COMMIT;