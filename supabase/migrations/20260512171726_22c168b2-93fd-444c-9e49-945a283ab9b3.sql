DO $$ BEGIN
  CREATE TYPE tipo_cliente AS ENUM ('lojista_b2b', 'consumidor_b2c');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE clientes 
  ADD COLUMN IF NOT EXISTS tipo_cliente tipo_cliente DEFAULT 'consumidor_b2c';

UPDATE clientes 
SET tipo_cliente = 'lojista_b2b'
WHERE deleted_at IS NULL 
  AND tipo_cliente IS NULL;

ALTER TABLE clientes ALTER COLUMN tipo_cliente SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_lojistas 
  ON clientes(empresa_id, tipo_cliente) 
  WHERE tipo_cliente = 'lojista_b2b' AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.alterar_tipo_cliente(
  p_cliente_id uuid,
  p_novo_tipo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_tipo_atual text;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
  
  IF v_empresa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem empresa');
  END IF;

  IF p_novo_tipo NOT IN ('lojista_b2b', 'consumidor_b2c') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tipo invalido');
  END IF;

  SELECT tipo_cliente::text INTO v_tipo_atual 
  FROM clientes 
  WHERE id = p_cliente_id AND empresa_id = v_empresa_id AND deleted_at IS NULL;
  
  IF v_tipo_atual IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente nao encontrado');
  END IF;

  IF v_tipo_atual = p_novo_tipo THEN
    RETURN jsonb_build_object('success', true, 'no_op', true, 'message', 'Tipo ja era esse');
  END IF;

  UPDATE clientes 
  SET tipo_cliente = p_novo_tipo::tipo_cliente,
      updated_at = now()
  WHERE id = p_cliente_id AND empresa_id = v_empresa_id;

  RETURN jsonb_build_object(
    'success', true, 
    'tipo_anterior', v_tipo_atual,
    'tipo_novo', p_novo_tipo
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.alterar_tipo_cliente(uuid, text) TO authenticated;