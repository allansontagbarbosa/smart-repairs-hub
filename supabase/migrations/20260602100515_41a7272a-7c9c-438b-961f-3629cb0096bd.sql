CREATE TABLE IF NOT EXISTS public.compras_lista_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL,
  peca_chave   text NOT NULL,
  peca_nome    text,
  qtd_ajustada int,
  comprado     boolean DEFAULT false,
  custo_manual numeric(12,2),
  avulso       boolean DEFAULT false,
  data_ref     date NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_compras_ajuste
  ON public.compras_lista_ajustes (empresa_id, data_ref, lower(peca_chave));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras_lista_ajustes TO authenticated;
GRANT ALL ON public.compras_lista_ajustes TO service_role;

ALTER TABLE public.compras_lista_ajustes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.compras_lista_ajustes;
CREATE POLICY tenant_isolation ON public.compras_lista_ajustes FOR ALL TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE OR REPLACE FUNCTION public.compras_salvar_ajuste(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id();
BEGIN
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success',false,'error','sem empresa'); END IF;
  INSERT INTO public.compras_lista_ajustes
    (empresa_id, peca_chave, peca_nome, qtd_ajustada, comprado, custo_manual, avulso, data_ref)
  VALUES (v_emp,
    lower(p_payload->>'peca_chave'), p_payload->>'peca_nome',
    NULLIF(p_payload->>'qtd_ajustada','')::int,
    COALESCE((p_payload->>'comprado')::boolean,false),
    NULLIF(p_payload->>'custo_manual','')::numeric,
    COALESCE((p_payload->>'avulso')::boolean,false),
    COALESCE(NULLIF(p_payload->>'data_ref','')::date, CURRENT_DATE))
  ON CONFLICT (empresa_id, data_ref, lower(peca_chave)) DO UPDATE SET
    qtd_ajustada = EXCLUDED.qtd_ajustada,
    comprado     = EXCLUDED.comprado,
    custo_manual = EXCLUDED.custo_manual,
    peca_nome    = COALESCE(EXCLUDED.peca_nome, public.compras_lista_ajustes.peca_nome);
  RETURN jsonb_build_object('success',true);
END; $$;

CREATE OR REPLACE FUNCTION public.compras_remover_avulso(p_peca_chave text, p_data date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id();
BEGIN
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success',false,'error','sem empresa'); END IF;
  DELETE FROM public.compras_lista_ajustes
   WHERE empresa_id = v_emp AND avulso = true
     AND lower(peca_chave) = lower(p_peca_chave)
     AND data_ref = COALESCE(p_data, CURRENT_DATE);
  RETURN jsonb_build_object('success',true);
END; $$;