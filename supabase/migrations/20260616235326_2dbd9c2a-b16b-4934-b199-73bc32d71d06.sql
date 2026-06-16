-- ===== Bloco 1.3: índices únicos case-insensitive =====
CREATE UNIQUE INDEX IF NOT EXISTS ux_atacado_status_nome_lower
  ON public.atacado_status_aparelho (empresa_id, lower(nome))
  WHERE ativo = true;

CREATE UNIQUE INDEX IF NOT EXISTS ux_atacado_moedas_codigo_lower
  ON public.atacado_moedas (empresa_id, lower(codigo));

CREATE UNIQUE INDEX IF NOT EXISTS ux_atacado_catalogo_marca_modelo_lower
  ON public.atacado_catalogo_modelos (empresa_id, lower(marca), lower(modelo))
  WHERE ativo = true;

-- ===== Helper de normalização: trim + colapsa espaços =====
CREATE OR REPLACE FUNCTION public.atacado_norm_text(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(regexp_replace(btrim(coalesce(p,'')), '\s+', ' ', 'g'), '')
$$;

-- ===== Bloco 1.1/1.2: RPCs atualizadas com normalização =====
CREATE OR REPLACE FUNCTION public.atacado_add_pais(p_nome text, p_codigo text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid; v_n text := public.atacado_norm_text(p_nome);
BEGIN
  IF v_emp IS NULL OR v_n IS NULL THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_paises WHERE empresa_id=v_emp AND lower(nome)=lower(v_n);
  IF v_id IS NULL THEN
    INSERT INTO atacado_paises(empresa_id,nome,codigo) VALUES (v_emp, v_n, public.atacado_norm_text(p_codigo)) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_capacidade(p_nome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid; v_ord int; v_n text := public.atacado_norm_text(p_nome);
BEGIN
  IF v_emp IS NULL OR v_n IS NULL THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_capacidades WHERE empresa_id=v_emp AND lower(nome)=lower(v_n);
  IF v_id IS NULL THEN
    SELECT coalesce(max(ordem),0)+1 INTO v_ord FROM atacado_capacidades WHERE empresa_id=v_emp;
    INSERT INTO atacado_capacidades(empresa_id,nome,ordem) VALUES (v_emp, v_n, v_ord) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_condicao(p_nome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid; v_ord int; v_n text := public.atacado_norm_text(p_nome);
BEGIN
  IF v_emp IS NULL OR v_n IS NULL THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_condicoes WHERE empresa_id=v_emp AND lower(nome)=lower(v_n);
  IF v_id IS NULL THEN
    SELECT coalesce(max(ordem),0)+1 INTO v_ord FROM atacado_condicoes WHERE empresa_id=v_emp;
    INSERT INTO atacado_condicoes(empresa_id,nome,ordem) VALUES (v_emp, v_n, v_ord) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_grade(p_nome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid; v_ord int; v_n text := public.atacado_norm_text(p_nome);
BEGIN
  IF v_emp IS NULL OR v_n IS NULL THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_grades WHERE empresa_id=v_emp AND lower(nome)=lower(v_n);
  IF v_id IS NULL THEN
    SELECT coalesce(max(ordem),0)+1 INTO v_ord FROM atacado_grades WHERE empresa_id=v_emp;
    INSERT INTO atacado_grades(empresa_id,nome,ordem) VALUES (v_emp, v_n, v_ord) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_status(p_nome text, p_cor text DEFAULT '#888')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid; v_ord int; v_n text := public.atacado_norm_text(p_nome);
BEGIN
  IF v_emp IS NULL OR v_n IS NULL THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_status_aparelho WHERE empresa_id=v_emp AND lower(nome)=lower(v_n) AND ativo = true;
  IF v_id IS NULL THEN
    SELECT coalesce(max(ordem),0)+1 INTO v_ord FROM atacado_status_aparelho WHERE empresa_id=v_emp;
    INSERT INTO atacado_status_aparelho(empresa_id,nome,cor,ordem) VALUES (v_emp, v_n, p_cor, v_ord) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_tipo_assistencia(p_nome text, p_valor numeric DEFAULT 0)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid; v_n text := public.atacado_norm_text(p_nome);
BEGIN
  IF v_emp IS NULL OR v_n IS NULL THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_tipos_assistencia WHERE empresa_id=v_emp AND lower(nome)=lower(v_n);
  IF v_id IS NULL THEN
    INSERT INTO atacado_tipos_assistencia(empresa_id,nome,valor_padrao) VALUES (v_emp, v_n, coalesce(p_valor,0)) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_moeda(p_codigo text, p_simbolo text DEFAULT NULL, p_nome text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid; v_cod text := public.atacado_norm_text(p_codigo);
BEGIN
  IF v_emp IS NULL OR v_cod IS NULL THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_moedas WHERE empresa_id=v_emp AND lower(codigo)=lower(v_cod);
  IF v_id IS NULL THEN
    INSERT INTO atacado_moedas(empresa_id,codigo,simbolo,nome)
    VALUES (v_emp, upper(v_cod), public.atacado_norm_text(p_simbolo), public.atacado_norm_text(p_nome))
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_fornecedor(p_nome text, p_cnpj text DEFAULT NULL, p_telefone text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid := public.get_my_empresa_id(); v_id uuid; v_n text := public.atacado_norm_text(p_nome);
BEGIN
  IF v_emp IS NULL OR v_n IS NULL THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM fornecedores WHERE empresa_id=v_emp AND lower(nome)=lower(v_n);
  IF v_id IS NULL THEN
    INSERT INTO fornecedores(empresa_id,nome,cnpj_cpf,telefone)
    VALUES (v_emp, v_n, public.atacado_norm_text(p_cnpj), public.atacado_norm_text(p_telefone))
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

-- Bloco 2: marca não aceita nome que já é modelo
CREATE OR REPLACE FUNCTION public.atacado_add_marca(p_marca text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_n text := public.atacado_norm_text(p_marca);
  v_exists boolean;
  v_collide boolean;
BEGIN
  IF v_emp IS NULL OR v_n IS NULL THEN RAISE EXCEPTION 'dados inválidos'; END IF;

  -- Já existe como marca? só reaproveita
  SELECT EXISTS(
    SELECT 1 FROM atacado_catalogo_modelos
    WHERE empresa_id=v_emp AND lower(marca)=lower(v_n)
  ) INTO v_exists;

  IF NOT v_exists THEN
    -- Bloqueia se o nome já é usado como modelo (de qualquer marca)
    SELECT EXISTS(
      SELECT 1 FROM atacado_catalogo_modelos
      WHERE empresa_id=v_emp AND lower(modelo)=lower(v_n) AND modelo <> '—'
    ) INTO v_collide;

    IF v_collide THEN
      RAISE EXCEPTION '"%" já existe como modelo. Cadastre-o escolhendo a marca e depois o modelo.', v_n
        USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO atacado_catalogo_modelos(empresa_id,marca,modelo,capacidades,cores)
    VALUES (v_emp, upper(v_n), '—', '{}', '{}');
  END IF;
  RETURN upper(v_n);
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_modelo(p_marca text, p_modelo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_id uuid;
  v_marca text := public.atacado_norm_text(p_marca);
  v_modelo text := public.atacado_norm_text(p_modelo);
BEGIN
  IF v_emp IS NULL OR v_marca IS NULL OR v_modelo IS NULL THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_catalogo_modelos
   WHERE empresa_id=v_emp AND lower(marca)=lower(v_marca) AND lower(modelo)=lower(v_modelo);
  IF v_id IS NULL THEN
    INSERT INTO atacado_catalogo_modelos(empresa_id,marca,modelo,capacidades,cores)
    VALUES (v_emp, upper(v_marca), v_modelo, '{}', '{}') RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.atacado_add_cor(p_marca text, p_modelo text, p_cor text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_id uuid;
  v_marca text := public.atacado_norm_text(p_marca);
  v_modelo text := public.atacado_norm_text(p_modelo);
  v_cor text := public.atacado_norm_text(p_cor);
BEGIN
  IF v_emp IS NULL OR v_cor IS NULL THEN RAISE EXCEPTION 'dados inválidos'; END IF;
  SELECT id INTO v_id FROM atacado_modelo_cores
   WHERE empresa_id=v_emp
     AND lower(coalesce(marca,''))=lower(coalesce(v_marca,''))
     AND lower(coalesce(modelo,''))=lower(coalesce(v_modelo,''))
     AND lower(cor)=lower(v_cor);
  IF v_id IS NULL THEN
    INSERT INTO atacado_modelo_cores(empresa_id,marca,modelo,cor)
    VALUES (v_emp, v_marca, v_modelo, v_cor) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END; $$;