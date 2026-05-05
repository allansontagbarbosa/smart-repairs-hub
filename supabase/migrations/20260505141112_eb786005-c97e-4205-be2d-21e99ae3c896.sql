
BEGIN;

CREATE TABLE IF NOT EXISTS public.rate_limit_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao text NOT NULL,
  identificador text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup
  ON public.rate_limit_tentativas (acao, identificador, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_cleanup
  ON public.rate_limit_tentativas (created_at);

ALTER TABLE public.rate_limit_tentativas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.checar_rate_limit(
  p_acao text,
  p_identificador text,
  p_max_tentativas int DEFAULT 5,
  p_janela_segundos int DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tentativas int;
  v_janela_inicio timestamptz;
  v_primeiro_recente timestamptz;
BEGIN
  IF p_acao IS NULL OR p_identificador IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'parametros invalidos');
  END IF;

  v_janela_inicio := now() - (p_janela_segundos || ' seconds')::interval;

  SELECT COUNT(*), MIN(created_at)
    INTO v_tentativas, v_primeiro_recente
  FROM public.rate_limit_tentativas
  WHERE acao = p_acao
    AND identificador = p_identificador
    AND created_at >= v_janela_inicio;

  IF v_tentativas >= p_max_tentativas THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'tentativas', v_tentativas,
      'retry_after_seconds', GREATEST(
        1,
        EXTRACT(EPOCH FROM (v_primeiro_recente + (p_janela_segundos || ' seconds')::interval - now()))::int
      )
    );
  END IF;

  INSERT INTO public.rate_limit_tentativas (acao, identificador)
  VALUES (p_acao, p_identificador);

  RETURN jsonb_build_object(
    'allowed', true,
    'tentativas', v_tentativas + 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.checar_rate_limit(text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checar_rate_limit(text, text, int, int) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.limpar_rate_limit_antigos()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_removidos int;
BEGIN
  DELETE FROM public.rate_limit_tentativas
  WHERE created_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_removidos = ROW_COUNT;
  RETURN v_removidos;
END;
$$;

REVOKE ALL ON FUNCTION public.limpar_rate_limit_antigos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.limpar_rate_limit_antigos() TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'limpar_rate_limit') THEN
      PERFORM cron.unschedule('limpar_rate_limit');
    END IF;
    PERFORM cron.schedule(
      'limpar_rate_limit',
      '0 3 * * *',
      $cron$ SELECT public.limpar_rate_limit_antigos(); $cron$
    );
  END IF;
END $$;

-- Atualiza consultar_os_publica com rate-limit por número de OS
CREATE OR REPLACE FUNCTION public.consultar_os_publica(
  p_numero text,
  p_telefone_4digitos text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_numero_int int;
  v_dados record;
  v_telefone_norm text;
  v_rate jsonb;
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

  v_rate := public.checar_rate_limit(
    'consultar_os_publica',
    'numero=' || v_numero_int::text,
    5,
    60
  );

  IF NOT (v_rate->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Muitas tentativas. Tente novamente em ' || (v_rate->>'retry_after_seconds') || ' segundos.',
      'retry_after_seconds', (v_rate->>'retry_after_seconds')::int
    );
  END IF;

  v_telefone_norm := regexp_replace(p_telefone_4digitos, '[^0-9]', '', 'g');
  v_telefone_norm := right(v_telefone_norm, 4);

  IF length(v_telefone_norm) < 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Informe 4 dígitos numéricos');
  END IF;

  SELECT
    o.id, o.numero, o.numero_formatado, o.status::text AS status,
    o.defeito_relatado, o.valor, o.previsao_entrega,
    o.data_entrada, o.data_conclusao, o.data_entrega,
    a.marca AS aparelho_marca, a.modelo AS aparelho_modelo,
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
      'aparelho', jsonb_build_object('marca', v_dados.aparelho_marca, 'modelo', v_dados.aparelho_modelo),
      'cliente_nome', v_dados.cliente_nome
    )
  );
END;
$$;

COMMIT;
