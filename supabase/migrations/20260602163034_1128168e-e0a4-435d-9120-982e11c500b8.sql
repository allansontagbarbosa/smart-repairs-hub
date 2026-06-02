-- Tabela: preço de cada tipo de assistência POR modelo
CREATE TABLE IF NOT EXISTS public.atacado_modelo_assistencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  modelo_id uuid NOT NULL REFERENCES public.atacado_catalogo_modelos(id) ON DELETE CASCADE,
  tipo_id uuid NOT NULL REFERENCES public.atacado_tipos_assistencia(id) ON DELETE CASCADE,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, modelo_id, tipo_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_modelo_assistencias TO authenticated;
GRANT ALL ON public.atacado_modelo_assistencias TO service_role;

ALTER TABLE public.atacado_modelo_assistencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mod_assist_select" ON public.atacado_modelo_assistencias
  FOR SELECT TO authenticated USING (empresa_id = public.get_my_empresa_id());
CREATE POLICY "mod_assist_insert" ON public.atacado_modelo_assistencias
  FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_my_empresa_id());
CREATE POLICY "mod_assist_update" ON public.atacado_modelo_assistencias
  FOR UPDATE TO authenticated USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());
CREATE POLICY "mod_assist_delete" ON public.atacado_modelo_assistencias
  FOR DELETE TO authenticated USING (empresa_id = public.get_my_empresa_id());

CREATE INDEX IF NOT EXISTS idx_mod_assist_modelo ON public.atacado_modelo_assistencias(empresa_id, modelo_id);

-- RPC: lista assistências de um modelo
CREATE OR REPLACE FUNCTION public.atacado_assist_do_modelo(p_modelo_id uuid)
RETURNS TABLE (tipo_id uuid, tipo_nome text, valor numeric, ativo boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT t.id, t.nome, ma.valor, coalesce(ma.ativo,true)
  FROM public.atacado_modelo_assistencias ma
  JOIN public.atacado_tipos_assistencia t ON t.id = ma.tipo_id
  WHERE ma.empresa_id = public.get_my_empresa_id()
    AND ma.modelo_id = p_modelo_id AND ma.ativo
  ORDER BY t.nome;
$$;

-- RPC: define/atualiza preço de um tipo num modelo
CREATE OR REPLACE FUNCTION public.atacado_set_assist_modelo(p_modelo_id uuid, p_tipo_id uuid, p_valor numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid;
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'sem empresa'; END IF;
  INSERT INTO public.atacado_modelo_assistencias(empresa_id,modelo_id,tipo_id,valor)
  VALUES (v_emp,p_modelo_id,p_tipo_id,p_valor)
  ON CONFLICT (empresa_id,modelo_id,tipo_id) DO UPDATE SET valor=excluded.valor, ativo=true
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- RPC: desativar vínculo
CREATE OR REPLACE FUNCTION public.atacado_desativar_assist_modelo(p_modelo_id uuid, p_tipo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id();
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'sem empresa'; END IF;
  UPDATE public.atacado_modelo_assistencias
     SET ativo=false
   WHERE empresa_id=v_emp AND modelo_id=p_modelo_id AND tipo_id=p_tipo_id;
END; $$;

-- RPC: copiar assistências de um modelo para outro
CREATE OR REPLACE FUNCTION public.atacado_copiar_assist(p_origem uuid, p_destino uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_n int;
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'sem empresa'; END IF;
  INSERT INTO public.atacado_modelo_assistencias(empresa_id,modelo_id,tipo_id,valor)
  SELECT v_emp, p_destino, tipo_id, valor
  FROM public.atacado_modelo_assistencias
  WHERE empresa_id=v_emp AND modelo_id=p_origem AND ativo
  ON CONFLICT (empresa_id,modelo_id,tipo_id) DO UPDATE SET valor=excluded.valor, ativo=true;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END; $$;

GRANT EXECUTE ON FUNCTION public.atacado_assist_do_modelo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atacado_set_assist_modelo(uuid,uuid,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atacado_desativar_assist_modelo(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atacado_copiar_assist(uuid,uuid) TO authenticated;