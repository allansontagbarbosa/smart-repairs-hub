BEGIN;

-- 1) Remover policies anon abertas
DROP POLICY IF EXISTS "Anon read aparelhos" ON public.aparelhos;
DROP POLICY IF EXISTS "Anon read garantias" ON public.garantias;

-- 2) imei_device_cache
DROP POLICY IF EXISTS "Anon full access" ON public.imei_device_cache;
DROP POLICY IF EXISTS "Authenticated full access" ON public.imei_device_cache;

CREATE POLICY "imei_cache_select_anon" ON public.imei_device_cache
  FOR SELECT TO anon USING (true);
CREATE POLICY "imei_cache_select_authenticated" ON public.imei_device_cache
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "imei_cache_write_authenticated" ON public.imei_device_cache
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "imei_cache_update_authenticated" ON public.imei_device_cache
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 3) avaliacoes: INSERT anon exige OS válida e entregue
DROP POLICY IF EXISTS "Anon insert avaliacoes" ON public.avaliacoes;

CREATE POLICY "avaliacoes_insert_anon_com_os_valida" ON public.avaliacoes
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ordens_de_servico o
      WHERE o.id = avaliacoes.ordem_id
        AND o.deleted_at IS NULL
        AND o.status::text = 'entregue'
    )
  );

-- 4) RPC pública de consulta de OS
CREATE OR REPLACE FUNCTION public.consultar_os_publica(
  p_numero text,
  p_telefone_4digitos text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_numero_int int;
  v_dados record;
  v_telefone_norm text;
BEGIN
  IF p_numero IS NULL OR length(trim(p_numero)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Número da OS obrigatório');
  END IF;
  IF p_telefone_4digitos IS NULL OR length(trim(p_telefone_4digitos)) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe os 4 últimos dígitos do telefone');
  END IF;

  v_numero_int := NULLIF(regexp_replace(p_numero, '[^0-9]', '', 'g'), '')::int;
  IF v_numero_int IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Número inválido');
  END IF;

  v_telefone_norm := regexp_replace(p_telefone_4digitos, '[^0-9]', '', 'g');
  v_telefone_norm := right(v_telefone_norm, 4);
  IF length(v_telefone_norm) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe 4 dígitos numéricos');
  END IF;

  SELECT
    o.id,
    o.numero,
    o.numero_formatado,
    o.status::text AS status,
    o.defeito_relatado,
    o.valor,
    o.previsao_entrega,
    o.data_entrada,
    o.data_conclusao,
    o.data_entrega,
    a.marca AS aparelho_marca,
    a.modelo AS aparelho_modelo,
    cl.nome AS cliente_nome
  INTO v_dados
  FROM public.ordens_de_servico o
  JOIN public.aparelhos a ON a.id = o.aparelho_id
  JOIN public.clientes cl ON cl.id = a.cliente_id
  WHERE o.numero = v_numero_int
    AND o.deleted_at IS NULL
    AND right(regexp_replace(COALESCE(cl.telefone, ''), '[^0-9]', '', 'g'), 4) = v_telefone_norm;

  IF v_dados.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OS não encontrada ou dados não conferem');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'os', jsonb_build_object(
      'numero', v_dados.numero,
      'numero_formatado', v_dados.numero_formatado,
      'status', v_dados.status,
      'defeito_relatado', v_dados.defeito_relatado,
      'valor', v_dados.valor,
      'previsao_entrega', v_dados.previsao_entrega,
      'data_entrada', v_dados.data_entrada,
      'data_conclusao', v_dados.data_conclusao,
      'data_entrega', v_dados.data_entrega,
      'aparelho', jsonb_build_object(
        'marca', v_dados.aparelho_marca,
        'modelo', v_dados.aparelho_modelo
      ),
      'cliente_nome', v_dados.cliente_nome
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consultar_os_publica(text, text) TO anon, authenticated;

-- 5) Travar search_path nas 4 funções de email
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pg_temp;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pg_temp;

COMMIT;