DO $mig$
DECLARE
  r record;
  d text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public','coletar_dados_backup', 'FROM tipos_servico WHERE empresa_id = p_empresa_id AND deleted_at IS NULL', 'FROM tipos_servico WHERE empresa_id = p_empresa_id'),
    ('public','coletar_dados_backup', 'FROM aparelhos WHERE empresa_id = p_empresa_id AND deleted_at IS NULL', 'FROM aparelhos WHERE empresa_id = p_empresa_id'),
    ('public','catalogo_login', 'WHERE id = v_acesso.cliente_id AND empresa_id = v_empresa_id', 'WHERE atacado_clientes.id = v_acesso.cliente_id AND atacado_clientes.empresa_id = v_empresa_id'),
    ('admin','processar_evento_assinatura', 'payload, created_at', 'payload, criado_em')
  ) AS t(sch, fn, frm, rep) LOOP
    FOR d IN
      SELECT pg_get_functiondef(p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = r.sch AND p.proname = r.fn AND p.prokind = 'f'
    LOOP
      IF position(r.frm in d) = 0 THEN
        RAISE EXCEPTION 'padrao nao encontrado em %.%: %', r.sch, r.fn, r.frm;
      END IF;
      EXECUTE replace(d, r.frm, r.rep);
    END LOOP;
  END LOOP;
END $mig$;