
-- =========================================================
-- RPC: os_terceirizar
-- =========================================================
CREATE OR REPLACE FUNCTION public.os_terceirizar(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_os_id uuid := (p_payload->>'os_id')::uuid;
  v_terceiro_id uuid := NULLIF(p_payload->>'terceiro_id','')::uuid;
  v_terceiro_nome text := NULLIF(p_payload->>'terceiro_nome','');
  v_servico text := NULLIF(p_payload->>'servico','');
  v_custo numeric := COALESCE((p_payload->>'custo')::numeric, 0);
  v_data_envio date := COALESCE(NULLIF(p_payload->>'data_envio','')::date, CURRENT_DATE);
  v_previsao date := NULLIF(p_payload->>'previsao_retorno','')::date;
  v_obs text := NULLIF(p_payload->>'observacoes','');
  v_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa FROM public.ordens_de_servico WHERE id = v_os_id;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'OS não encontrada';
  END IF;
  IF v_empresa <> public.get_my_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Se veio terceiro_id sem nome, pega o nome do cadastro
  IF v_terceiro_id IS NOT NULL AND v_terceiro_nome IS NULL THEN
    SELECT nome INTO v_terceiro_nome FROM public.assistencia_terceiros WHERE id = v_terceiro_id;
  END IF;

  INSERT INTO public.assistencia_terceirizacoes
    (empresa_id, os_id, terceiro_id, terceiro_nome, servico, custo, data_envio, previsao_retorno, observacoes, status)
  VALUES
    (v_empresa, v_os_id, v_terceiro_id, v_terceiro_nome, v_servico, v_custo, v_data_envio, v_previsao, v_obs, 'enviado')
  RETURNING id INTO v_id;

  UPDATE public.ordens_de_servico
     SET status = 'terceirizado'::status_ordem
   WHERE id = v_os_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.os_terceirizar(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.os_terceirizar(jsonb) TO authenticated;

-- =========================================================
-- RPC: os_terceiro_retornou
-- =========================================================
CREATE OR REPLACE FUNCTION public.os_terceiro_retornou(
  p_terceirizacao_id uuid,
  p_novo_status_os text DEFAULT 'em_reparo'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_os_id uuid;
BEGIN
  SELECT empresa_id, os_id INTO v_empresa, v_os_id
    FROM public.assistencia_terceirizacoes WHERE id = p_terceirizacao_id;

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Terceirização não encontrada';
  END IF;
  IF v_empresa <> public.get_my_empresa_id() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.assistencia_terceirizacoes
     SET status = 'retornado',
         data_retorno = CURRENT_DATE
   WHERE id = p_terceirizacao_id;

  UPDATE public.ordens_de_servico
     SET status = p_novo_status_os::status_ordem
   WHERE id = v_os_id;
END;
$$;

REVOKE ALL ON FUNCTION public.os_terceiro_retornou(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.os_terceiro_retornou(uuid, text) TO authenticated;

-- =========================================================
-- RPC: assistencia_aparelhos_na_rua
-- =========================================================
CREATE OR REPLACE FUNCTION public.assistencia_aparelhos_na_rua()
RETURNS TABLE (
  terceirizacao_id uuid,
  os_id uuid,
  terceiro_nome text,
  servico text,
  custo numeric,
  data_envio date,
  previsao_retorno date,
  dias_fora integer,
  atrasado boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id AS terceirizacao_id,
    t.os_id,
    COALESCE(t.terceiro_nome, ter.nome) AS terceiro_nome,
    t.servico,
    t.custo,
    t.data_envio,
    t.previsao_retorno,
    (CURRENT_DATE - t.data_envio)::int AS dias_fora,
    (t.previsao_retorno IS NOT NULL AND CURRENT_DATE > t.previsao_retorno) AS atrasado
  FROM public.assistencia_terceirizacoes t
  LEFT JOIN public.assistencia_terceiros ter ON ter.id = t.terceiro_id
  WHERE t.status = 'enviado'
    AND t.empresa_id = public.get_my_empresa_id()
  ORDER BY t.data_envio ASC;
$$;

REVOKE ALL ON FUNCTION public.assistencia_aparelhos_na_rua() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assistencia_aparelhos_na_rua() TO authenticated;

-- =========================================================
-- Trigger: recalcular totais da OS quando terceirização mudar
-- =========================================================
CREATE OR REPLACE FUNCTION public.trg_assist_terc_recalc_os_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os uuid;
BEGIN
  v_os := COALESCE(NEW.os_id, OLD.os_id);
  IF v_os IS NOT NULL THEN
    PERFORM public.recalcular_totais_os(v_os);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_assist_terc_recalc_os ON public.assistencia_terceirizacoes;
CREATE TRIGGER trg_assist_terc_recalc_os
AFTER INSERT OR UPDATE OR DELETE ON public.assistencia_terceirizacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_assist_terc_recalc_os_fn();
