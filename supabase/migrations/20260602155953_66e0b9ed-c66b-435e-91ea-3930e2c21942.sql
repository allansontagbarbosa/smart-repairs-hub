
-- ============ Bloco 1: Tabelas novas ============

CREATE TABLE IF NOT EXISTS public.atacado_paises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  codigo text,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS atacado_paises_empresa_nome_uq
  ON public.atacado_paises (empresa_id, lower(nome));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_paises TO authenticated;
GRANT ALL ON public.atacado_paises TO service_role;

ALTER TABLE public.atacado_paises ENABLE ROW LEVEL SECURITY;

CREATE POLICY paises_select ON public.atacado_paises FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());
CREATE POLICY paises_ins ON public.atacado_paises FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_my_empresa_id());
CREATE POLICY paises_upd ON public.atacado_paises FOR UPDATE TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());
CREATE POLICY paises_del ON public.atacado_paises FOR DELETE TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

CREATE TABLE IF NOT EXISTS public.atacado_capacidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS atacado_capacidades_empresa_nome_uq
  ON public.atacado_capacidades (empresa_id, lower(nome));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_capacidades TO authenticated;
GRANT ALL ON public.atacado_capacidades TO service_role;

ALTER TABLE public.atacado_capacidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY cap_select ON public.atacado_capacidades FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());
CREATE POLICY cap_ins ON public.atacado_capacidades FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_my_empresa_id());
CREATE POLICY cap_upd ON public.atacado_capacidades FOR UPDATE TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());
CREATE POLICY cap_del ON public.atacado_capacidades FOR DELETE TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

CREATE TABLE IF NOT EXISTS public.atacado_condicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS atacado_condicoes_empresa_nome_uq
  ON public.atacado_condicoes (empresa_id, lower(nome));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atacado_condicoes TO authenticated;
GRANT ALL ON public.atacado_condicoes TO service_role;

ALTER TABLE public.atacado_condicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY cond_select ON public.atacado_condicoes FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());
CREATE POLICY cond_ins ON public.atacado_condicoes FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_my_empresa_id());
CREATE POLICY cond_upd ON public.atacado_condicoes FOR UPDATE TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());
CREATE POLICY cond_del ON public.atacado_condicoes FOR DELETE TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

-- ============ Adicionar coluna ativo onde falta ============
ALTER TABLE public.atacado_moedas        ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.atacado_modelo_cores  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.atacado_status_aparelho ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- ============ Bloco 2: RPCs idempotentes ============

CREATE OR REPLACE FUNCTION public.atacado_add_pais(p_nome text, p_codigo text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid;
BEGIN
  IF v_emp IS NULL OR coalesce(trim(p_nome),'')='' THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_paises WHERE empresa_id=v_emp AND lower(nome)=lower(trim(p_nome));
  IF v_id IS NULL THEN
    INSERT INTO atacado_paises(empresa_id,nome,codigo) VALUES (v_emp, trim(p_nome), nullif(trim(coalesce(p_codigo,'')),'')) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_capacidade(p_nome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid; v_ord int;
BEGIN
  IF v_emp IS NULL OR coalesce(trim(p_nome),'')='' THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_capacidades WHERE empresa_id=v_emp AND lower(nome)=lower(trim(p_nome));
  IF v_id IS NULL THEN
    SELECT coalesce(max(ordem),0)+1 INTO v_ord FROM atacado_capacidades WHERE empresa_id=v_emp;
    INSERT INTO atacado_capacidades(empresa_id,nome,ordem) VALUES (v_emp, trim(p_nome), v_ord) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_condicao(p_nome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid; v_ord int;
BEGIN
  IF v_emp IS NULL OR coalesce(trim(p_nome),'')='' THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_condicoes WHERE empresa_id=v_emp AND lower(nome)=lower(trim(p_nome));
  IF v_id IS NULL THEN
    SELECT coalesce(max(ordem),0)+1 INTO v_ord FROM atacado_condicoes WHERE empresa_id=v_emp;
    INSERT INTO atacado_condicoes(empresa_id,nome,ordem) VALUES (v_emp, trim(p_nome), v_ord) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_grade(p_nome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid; v_ord int;
BEGIN
  IF v_emp IS NULL OR coalesce(trim(p_nome),'')='' THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_grades WHERE empresa_id=v_emp AND lower(nome)=lower(trim(p_nome));
  IF v_id IS NULL THEN
    SELECT coalesce(max(ordem),0)+1 INTO v_ord FROM atacado_grades WHERE empresa_id=v_emp;
    INSERT INTO atacado_grades(empresa_id,nome,ordem) VALUES (v_emp, trim(p_nome), v_ord) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_status(p_nome text, p_cor text DEFAULT '#888')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid; v_ord int;
BEGIN
  IF v_emp IS NULL OR coalesce(trim(p_nome),'')='' THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_status_aparelho WHERE empresa_id=v_emp AND lower(nome)=lower(trim(p_nome));
  IF v_id IS NULL THEN
    SELECT coalesce(max(ordem),0)+1 INTO v_ord FROM atacado_status_aparelho WHERE empresa_id=v_emp;
    INSERT INTO atacado_status_aparelho(empresa_id,nome,cor,ordem) VALUES (v_emp, trim(p_nome), p_cor, v_ord) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_tipo_assistencia(p_nome text, p_valor numeric DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid;
BEGIN
  IF v_emp IS NULL OR coalesce(trim(p_nome),'')='' THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_tipos_assistencia WHERE empresa_id=v_emp AND lower(nome)=lower(trim(p_nome));
  IF v_id IS NULL THEN
    INSERT INTO atacado_tipos_assistencia(empresa_id,nome,valor_padrao) VALUES (v_emp, trim(p_nome), coalesce(p_valor,0)) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_moeda(p_codigo text, p_simbolo text DEFAULT NULL, p_nome text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid;
BEGIN
  IF v_emp IS NULL OR coalesce(trim(p_codigo),'')='' THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_moedas WHERE empresa_id=v_emp AND lower(codigo)=lower(trim(p_codigo));
  IF v_id IS NULL THEN
    INSERT INTO atacado_moedas(empresa_id,codigo,simbolo,nome) VALUES (v_emp, upper(trim(p_codigo)), nullif(trim(coalesce(p_simbolo,'')),''), nullif(trim(coalesce(p_nome,'')),'')) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_fornecedor(p_nome text, p_cnpj text DEFAULT NULL, p_telefone text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid;
BEGIN
  IF v_emp IS NULL OR coalesce(trim(p_nome),'')='' THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM fornecedores WHERE empresa_id=v_emp AND lower(nome)=lower(trim(p_nome));
  IF v_id IS NULL THEN
    INSERT INTO fornecedores(empresa_id,nome,cnpj_cpf,telefone) VALUES (v_emp, trim(p_nome), nullif(trim(coalesce(p_cnpj,'')),''), nullif(trim(coalesce(p_telefone,'')),'')) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_marca(p_marca text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_exists boolean;
BEGIN
  IF v_emp IS NULL OR coalesce(trim(p_marca),'')='' THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT EXISTS(SELECT 1 FROM atacado_catalogo_modelos WHERE empresa_id=v_emp AND lower(marca)=lower(trim(p_marca))) INTO v_exists;
  IF NOT v_exists THEN
    INSERT INTO atacado_catalogo_modelos(empresa_id,marca,modelo,capacidades,cores) VALUES (v_emp, upper(trim(p_marca)), '—', '{}', '{}');
  END IF;
  RETURN upper(trim(p_marca));
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_modelo(p_marca text, p_modelo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid;
BEGIN
  IF v_emp IS NULL OR coalesce(trim(p_marca),'')='' OR coalesce(trim(p_modelo),'')='' THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_catalogo_modelos
   WHERE empresa_id=v_emp AND lower(marca)=lower(trim(p_marca)) AND lower(modelo)=lower(trim(p_modelo));
  IF v_id IS NULL THEN
    INSERT INTO atacado_catalogo_modelos(empresa_id,marca,modelo,capacidades,cores)
    VALUES (v_emp, upper(trim(p_marca)), trim(p_modelo), '{}', '{}') RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_cor(p_marca text, p_modelo text, p_cor text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid;
BEGIN
  IF v_emp IS NULL OR coalesce(trim(p_cor),'')='' THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_modelo_cores
   WHERE empresa_id=v_emp AND lower(coalesce(marca,''))=lower(coalesce(trim(p_marca),''))
     AND lower(coalesce(modelo,''))=lower(coalesce(trim(p_modelo),''))
     AND lower(cor)=lower(trim(p_cor));
  IF v_id IS NULL THEN
    INSERT INTO atacado_modelo_cores(empresa_id,marca,modelo,cor)
    VALUES (v_emp, nullif(trim(coalesce(p_marca,'')),''), nullif(trim(coalesce(p_modelo,'')),''), trim(p_cor)) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;
