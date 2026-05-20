DO $mig$
DECLARE
  v_src text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='get_painel_socio_v1';

  v_new := replace(
    v_src,
    E'    JOIN public.os_servicos s ON s.id = c.servico_id\n    JOIN public.ordens_de_servico o ON o.id = s.ordem_id\n',
    E'    JOIN public.ordens_de_servico o ON o.id = c.ordem_id\n'
  );

  IF v_new = v_src THEN
    RAISE EXCEPTION 'Padrão não encontrado';
  END IF;

  EXECUTE v_new;
END
$mig$;