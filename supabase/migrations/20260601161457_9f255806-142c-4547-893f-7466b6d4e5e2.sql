CREATE TABLE IF NOT EXISTS public.etiqueta_calibracao (
  empresa_id   uuid PRIMARY KEY,
  offset_x_mm  numeric(5,2) NOT NULL DEFAULT 0,
  offset_y_mm  numeric(5,2) NOT NULL DEFAULT 0,
  margem_mm    numeric(5,2) NOT NULL DEFAULT 2,
  alinhamento  text NOT NULL DEFAULT 'mc',
  largura_mm   numeric(5,2) NOT NULL DEFAULT 54,
  altura_mm    numeric(5,2) NOT NULL DEFAULT 25,
  atualizado_em timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.etiqueta_calibracao TO authenticated;
GRANT ALL ON public.etiqueta_calibracao TO service_role;

ALTER TABLE public.etiqueta_calibracao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON public.etiqueta_calibracao;
CREATE POLICY tenant_isolation ON public.etiqueta_calibracao FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE OR REPLACE FUNCTION public.salvar_calibracao_etiqueta(
  p_offset_x numeric, p_offset_y numeric, p_margem numeric,
  p_alinhamento text, p_largura numeric, p_altura numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id();
BEGIN
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success',false,'error','sem empresa'); END IF;
  INSERT INTO public.etiqueta_calibracao
    (empresa_id, offset_x_mm, offset_y_mm, margem_mm, alinhamento, largura_mm, altura_mm, atualizado_em)
  VALUES (v_emp, COALESCE(p_offset_x,0), COALESCE(p_offset_y,0), COALESCE(p_margem,2),
          COALESCE(p_alinhamento,'mc'), COALESCE(p_largura,54), COALESCE(p_altura,25), now())
  ON CONFLICT (empresa_id) DO UPDATE SET
    offset_x_mm = EXCLUDED.offset_x_mm, offset_y_mm = EXCLUDED.offset_y_mm,
    margem_mm = EXCLUDED.margem_mm, alinhamento = EXCLUDED.alinhamento,
    largura_mm = EXCLUDED.largura_mm, altura_mm = EXCLUDED.altura_mm, atualizado_em = now();
  RETURN jsonb_build_object('success',true);
END; $$;