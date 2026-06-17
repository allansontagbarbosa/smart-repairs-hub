
ALTER TABLE public.atacado_status_aparelho
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'em_estoque'
  CHECK (categoria IN ('em_estoque','reservado','vendido','em_transito','outro'));

-- Back-fill heurístico
UPDATE public.atacado_status_aparelho SET categoria = CASE
  WHEN lower(nome) ~ '(transit|transporte|caminho|rota|envio|enviado)' THEN 'em_transito'
  WHEN lower(nome) ~ '(reserv|separad|aguard)' THEN 'reservado'
  WHEN lower(nome) ~ '(vendid|baixad|entregue)' THEN 'vendido'
  WHEN lower(nome) ~ '(estoq|stoq|disponiv|disponíve)' THEN 'em_estoque'
  WHEN lower(nome) ~ '(assist|defeito|conserto|manut)' THEN 'outro'
  ELSE 'em_estoque'
END;

CREATE OR REPLACE FUNCTION public.atacado_add_status(
  p_nome text,
  p_cor text DEFAULT '#888'::text,
  p_categoria text DEFAULT 'em_estoque'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_id uuid;
  v_ord int;
  v_n text := public.atacado_norm_text(p_nome);
  v_cat text := COALESCE(NULLIF(p_categoria,''),'em_estoque');
BEGIN
  IF v_emp IS NULL OR v_n IS NULL THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  IF v_cat NOT IN ('em_estoque','reservado','vendido','em_transito','outro') THEN
    v_cat := 'em_estoque';
  END IF;
  SELECT id INTO v_id FROM atacado_status_aparelho
    WHERE empresa_id=v_emp AND lower(nome)=lower(v_n) AND ativo = true;
  IF v_id IS NULL THEN
    SELECT coalesce(max(ordem),0)+1 INTO v_ord FROM atacado_status_aparelho WHERE empresa_id=v_emp;
    INSERT INTO atacado_status_aparelho(empresa_id,nome,cor,ordem,categoria)
      VALUES (v_emp, v_n, p_cor, v_ord, v_cat) RETURNING id INTO v_id;
  ELSE
    UPDATE atacado_status_aparelho SET categoria = v_cat WHERE id = v_id;
  END IF;
  RETURN v_id;
END; $function$;
