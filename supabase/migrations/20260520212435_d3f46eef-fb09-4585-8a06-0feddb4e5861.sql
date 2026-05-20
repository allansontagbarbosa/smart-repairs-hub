
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clientes') THEN
    RAISE EXCEPTION 'Tabela clientes não existe';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='lojista_grupos') THEN
    RAISE EXCEPTION 'Tabela lojista_grupos não existe';
  END IF;
END$$;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES public.lojista_grupos(id);

CREATE INDEX IF NOT EXISTS idx_clientes_grupo
  ON public.clientes(grupo_id)
  WHERE grupo_id IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_lojista_contexto()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_grupo record;
  v_cliente record;
  v_lojas_grupo jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('tipo', 'anonimo');
  END IF;

  SELECT id, empresa_id, nome, razao_social, cnpj_matriz, email
    INTO v_grupo
    FROM public.lojista_grupos
    WHERE user_id = v_user_id
      AND ativo = true
      AND deleted_at IS NULL
    LIMIT 1;

  IF v_grupo.id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'nome', c.nome,
      'email', c.email,
      'telefone', c.telefone,
      'whatsapp', c.whatsapp
    ) ORDER BY c.nome), '[]'::jsonb)
      INTO v_lojas_grupo
      FROM public.clientes c
      WHERE c.grupo_id = v_grupo.id
        AND c.tipo_cliente = 'lojista_b2b'
        AND c.deleted_at IS NULL;

    RETURN jsonb_build_object(
      'tipo', 'grupo',
      'grupo_id', v_grupo.id,
      'grupo_nome', v_grupo.nome,
      'empresa_id', v_grupo.empresa_id,
      'lojas', v_lojas_grupo,
      'qtd_lojas', jsonb_array_length(v_lojas_grupo)
    );
  END IF;

  SELECT id, empresa_id, nome, email
    INTO v_cliente
    FROM public.clientes
    WHERE user_id = v_user_id
      AND tipo_cliente = 'lojista_b2b'
      AND deleted_at IS NULL
    LIMIT 1;

  IF v_cliente.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'tipo', 'individual',
      'lojista_id', v_cliente.id,
      'lojista_nome', v_cliente.nome,
      'empresa_id', v_cliente.empresa_id,
      'lojas', jsonb_build_array(jsonb_build_object(
        'id', v_cliente.id,
        'nome', v_cliente.nome,
        'email', v_cliente.email
      ))
    );
  END IF;

  RETURN jsonb_build_object('tipo', 'nao_lojista');
END;
$$;
