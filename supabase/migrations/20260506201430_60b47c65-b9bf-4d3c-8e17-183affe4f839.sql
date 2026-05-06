CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.replicar_contas_recorrentes(
  p_origem text,
  p_destino text
)
RETURNS TABLE (
  origem text,
  destino text,
  inseridas int,
  puladas int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inseridas int := 0;
  v_puladas int := 0;
BEGIN
  WITH origem AS (
    SELECT
      cap.descricao,
      cap.valor,
      cap.categoria,
      cap.centro_custo,
      (date_trunc('month', to_date(p_destino || '-01', 'YYYY-MM-DD'))
        + (extract(day from cap.data_vencimento) - 1) * interval '1 day')::date AS data_vencimento,
      cap.observacoes,
      cap.empresa_id,
      cap.created_by
    FROM contas_a_pagar cap
    WHERE cap.mes_competencia = p_origem
      AND cap.recorrente = TRUE
      AND cap.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM contas_a_pagar dest
        WHERE dest.descricao = cap.descricao
          AND dest.mes_competencia = p_destino
          AND dest.recorrente = TRUE
          AND dest.deleted_at IS NULL
      )
  ),
  inseridos AS (
    INSERT INTO contas_a_pagar (
      descricao, valor, categoria, centro_custo, data_vencimento,
      data_pagamento, status, recorrente, mes_competencia,
      observacoes, empresa_id, created_by
    )
    SELECT
      o.descricao, o.valor, o.categoria, o.centro_custo, o.data_vencimento,
      NULL,
      'pendente'::status_conta,
      TRUE,
      p_destino,
      o.observacoes, o.empresa_id, o.created_by
    FROM origem o
    RETURNING 1
  )
  SELECT count(*) INTO v_inseridas FROM inseridos;

  SELECT count(*) INTO v_puladas
  FROM contas_a_pagar cap
  WHERE cap.mes_competencia = p_origem
    AND cap.recorrente = TRUE
    AND cap.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM contas_a_pagar dest
      WHERE dest.descricao = cap.descricao
        AND dest.mes_competencia = p_destino
        AND dest.recorrente = TRUE
        AND dest.deleted_at IS NULL
    );

  RETURN QUERY SELECT p_origem, p_destino, v_inseridas, v_puladas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replicar_contas_recorrentes(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.replicar_contas_recorrentes_mes_atual()
RETURNS TABLE (
  origem text,
  destino text,
  inseridas int,
  puladas int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_destino text;
  v_origem text;
BEGIN
  v_destino := to_char(now(), 'YYYY-MM');
  v_origem := to_char(now() - interval '1 month', 'YYYY-MM');
  RETURN QUERY SELECT * FROM public.replicar_contas_recorrentes(v_origem, v_destino);
END;
$$;

GRANT EXECUTE ON FUNCTION public.replicar_contas_recorrentes_mes_atual() TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'replicar_contas_recorrentes_mensal') THEN
    PERFORM cron.unschedule('replicar_contas_recorrentes_mensal');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'replicar_contas_recorrentes_mensal',
  '0 2 1 * *',
  $$SELECT public.replicar_contas_recorrentes_mes_atual();$$
);

SELECT * FROM public.replicar_contas_recorrentes('2026-04', '2026-05');