
-- Tabela temporária pra capturar os resultados
DROP TABLE IF EXISTS public._rls_attack_results;
CREATE TABLE public._rls_attack_results (
  ordem int,
  teste text,
  resultado text
);

DO $$
DECLARE
  v_cliente_id uuid;
  v_cliente_email text;
  v_staff_id uuid := 'c69e013b-bb17-4908-82f9-5689a196ac48';
  v_count bigint;
  v_bool text;
BEGIN
  -- Pega um cliente real (qualquer user_profile com empresa_id)
  SELECT up.user_id, u.email
  INTO v_cliente_id, v_cliente_email
  FROM public.user_profiles up
  JOIN auth.users u ON u.id = up.user_id
  WHERE up.empresa_id IS NOT NULL
    AND up.user_id <> v_staff_id
  LIMIT 1;

  INSERT INTO public._rls_attack_results VALUES
    (0, 'CLIENTE simulado', COALESCE(v_cliente_email,'(nenhum)') || ' / ' || COALESCE(v_cliente_id::text,'-'));

  IF v_cliente_id IS NULL THEN
    INSERT INTO public._rls_attack_results VALUES (99,'ERRO','Nenhum cliente encontrado pra simular');
    RETURN;
  END IF;

  ----------------------------------------------------------------
  -- Simula CLIENTE
  ----------------------------------------------------------------
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cliente_id::text, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_cliente_id::text, true);

  BEGIN
    EXECUTE 'SELECT count(*) FROM admin.usuarios_internos' INTO v_count;
    INSERT INTO public._rls_attack_results VALUES (1,'CLIENTE lê admin.usuarios_internos', v_count::text || ' linhas');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._rls_attack_results VALUES (1,'CLIENTE lê admin.usuarios_internos', 'BLOQUEADO: '||SQLERRM);
  END;

  BEGIN
    EXECUTE 'SELECT count(*) FROM admin.assinaturas' INTO v_count;
    INSERT INTO public._rls_attack_results VALUES (2,'CLIENTE lê admin.assinaturas', v_count::text || ' linhas');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._rls_attack_results VALUES (2,'CLIENTE lê admin.assinaturas', 'BLOQUEADO: '||SQLERRM);
  END;

  BEGIN
    EXECUTE 'SELECT count(*) FROM admin.notas_cliente' INTO v_count;
    INSERT INTO public._rls_attack_results VALUES (3,'CLIENTE lê admin.notas_cliente', v_count::text || ' linhas');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._rls_attack_results VALUES (3,'CLIENTE lê admin.notas_cliente', 'BLOQUEADO: '||SQLERRM);
  END;

  BEGIN
    EXECUTE 'SELECT count(*) FROM public.empresas' INTO v_count;
    INSERT INTO public._rls_attack_results VALUES (4,'CLIENTE vê public.empresas', v_count::text || ' empresas visíveis');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._rls_attack_results VALUES (4,'CLIENTE vê public.empresas', 'BLOQUEADO: '||SQLERRM);
  END;

  BEGIN
    EXECUTE 'SELECT admin.is_staff()::text' INTO v_bool;
    INSERT INTO public._rls_attack_results VALUES (5,'CLIENTE: admin.is_staff()', v_bool);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._rls_attack_results VALUES (5,'CLIENTE: admin.is_staff()', 'ERRO: '||SQLERRM);
  END;

  -- Reset
  PERFORM set_config('role','postgres',true);

  ----------------------------------------------------------------
  -- Simula STAFF
  ----------------------------------------------------------------
  PERFORM set_config('role','authenticated',true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_id::text, 'role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);

  BEGIN
    EXECUTE 'SELECT count(*) FROM admin.usuarios_internos' INTO v_count;
    INSERT INTO public._rls_attack_results VALUES (6,'STAFF lê admin.usuarios_internos', v_count::text || ' linhas');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._rls_attack_results VALUES (6,'STAFF lê admin.usuarios_internos', 'BLOQUEADO: '||SQLERRM);
  END;

  BEGIN
    EXECUTE 'SELECT admin.is_staff()::text' INTO v_bool;
    INSERT INTO public._rls_attack_results VALUES (7,'STAFF: admin.is_staff()', v_bool);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._rls_attack_results VALUES (7,'STAFF: admin.is_staff()', 'ERRO: '||SQLERRM);
  END;

  PERFORM set_config('role','postgres',true);
END $$;
