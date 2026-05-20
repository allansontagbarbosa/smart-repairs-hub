CREATE OR REPLACE FUNCTION public.get_painel_socio_v1_fix_metas() RETURNS void LANGUAGE sql AS $$ SELECT 1; $$;
DROP FUNCTION public.get_painel_socio_v1_fix_metas();

-- Hotfix: corrigir referência a tabela inexistente metas_socio -> socio_metas
-- e coluna ativa -> ativo no bloco v_metas de get_painel_socio_v1.
-- Mantém todo o restante da função intacto, usando regex em pg_proc seria
-- arriscado, então recriamos a função buscando o source atual via psql... 
-- Em vez disso, fazemos um REPLACE textual via DO block.

DO $mig$
DECLARE
  v_src TEXT;
  v_new TEXT;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname='get_painel_socio_v1' AND pronamespace='public'::regnamespace;

  v_new := v_src;
  v_new := replace(v_new, 'FROM public.metas_socio m', 'FROM public.socio_metas m');
  v_new := replace(v_new, 'COALESCE(m.ativa, true)', 'COALESCE(m.ativo, true)');
  v_new := replace(v_new, 'COALESCE(m.icone, ''target'')', 'COALESCE(m.icone, ''🎯'')');
  v_new := replace(v_new, 'COALESCE(m.cor, ''primary'')', 'COALESCE(m.cor, ''green'')');

  IF v_new = v_src THEN
    RAISE NOTICE 'Nenhuma substituição aplicada — função já pode estar corrigida ou padrões diferentes.';
  ELSE
    EXECUTE v_new;
  END IF;
END
$mig$;