-- ATACADO-CONFIG-02
-- Bloco 2: Limpeza — separar "modelos" cadastrados como "marcas"
-- Linhas onde modelo='—'/'-' e marca tem mais de uma palavra são na verdade modelos.
-- Vira: marca = primeira palavra, modelo = marca original.
UPDATE public.atacado_catalogo_modelos AS m
SET marca = split_part(m.marca, ' ', 1),
    modelo = m.marca
WHERE m.modelo IN ('—','-')
  AND position(' ' in m.marca) > 0;

-- Bloco 3: RPC genérica de exclusão (só não-usados).
-- Retorna {success, error?, message?}. Em caso de uso, NÃO apaga e instrui a desativar.
CREATE OR REPLACE FUNCTION public.atacado_excluir_item(p_lista text, p_chave text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid := public.get_my_empresa_id();
  v_em_uso boolean := false;
  v_id uuid;
  v_nome text;
BEGIN
  IF v_emp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'sem_empresa');
  END IF;

  IF p_lista = 'moeda' THEN
    v_id := p_chave::uuid;
    SELECT codigo INTO v_nome FROM atacado_moedas WHERE id = v_id AND empresa_id = v_emp;
    SELECT EXISTS(SELECT 1 FROM atacado_invoices WHERE empresa_id = v_emp AND moeda = v_nome) INTO v_em_uso;
    IF NOT v_em_uso THEN DELETE FROM atacado_moedas WHERE id = v_id AND empresa_id = v_emp; END IF;

  ELSIF p_lista = 'fornecedor' THEN
    v_id := p_chave::uuid;
    SELECT nome INTO v_nome FROM fornecedores WHERE id = v_id AND empresa_id = v_emp;
    SELECT (EXISTS(SELECT 1 FROM atacado_aparelhos WHERE empresa_id = v_emp AND fornecedor_id = v_id)
         OR EXISTS(SELECT 1 FROM atacado_invoices  WHERE empresa_id = v_emp AND fornecedor = v_nome))
      INTO v_em_uso;
    IF NOT v_em_uso THEN DELETE FROM fornecedores WHERE id = v_id AND empresa_id = v_emp; END IF;

  ELSIF p_lista = 'pais' THEN
    v_id := p_chave::uuid;
    SELECT nome INTO v_nome FROM atacado_paises WHERE id = v_id AND empresa_id = v_emp;
    SELECT EXISTS(SELECT 1 FROM atacado_invoices WHERE empresa_id = v_emp AND pais_origem = v_nome) INTO v_em_uso;
    IF NOT v_em_uso THEN DELETE FROM atacado_paises WHERE id = v_id AND empresa_id = v_emp; END IF;

  ELSIF p_lista = 'marca' THEN
    v_nome := p_chave; -- chave da marca é o próprio nome
    SELECT EXISTS(SELECT 1 FROM atacado_aparelhos WHERE empresa_id = v_emp AND marca = v_nome) INTO v_em_uso;
    IF NOT v_em_uso THEN
      DELETE FROM atacado_catalogo_modelos WHERE empresa_id = v_emp AND marca = v_nome;
      DELETE FROM atacado_modelo_cores      WHERE empresa_id = v_emp AND marca = v_nome;
    END IF;

  ELSIF p_lista = 'modelo' THEN
    v_id := p_chave::uuid;
    SELECT modelo INTO v_nome FROM atacado_catalogo_modelos WHERE id = v_id AND empresa_id = v_emp;
    SELECT (EXISTS(SELECT 1 FROM atacado_aparelhos WHERE empresa_id = v_emp AND modelo = v_nome)
         OR EXISTS(SELECT 1 FROM atacado_modelo_assistencias WHERE empresa_id = v_emp AND modelo_id = v_id)
         OR EXISTS(SELECT 1 FROM atacado_modelo_cores WHERE empresa_id = v_emp AND modelo = v_nome))
      INTO v_em_uso;
    IF NOT v_em_uso THEN DELETE FROM atacado_catalogo_modelos WHERE id = v_id AND empresa_id = v_emp; END IF;

  ELSIF p_lista = 'capacidade' THEN
    v_id := p_chave::uuid;
    SELECT nome INTO v_nome FROM atacado_capacidades WHERE id = v_id AND empresa_id = v_emp;
    SELECT EXISTS(SELECT 1 FROM atacado_aparelhos WHERE empresa_id = v_emp AND capacidade = v_nome) INTO v_em_uso;
    IF NOT v_em_uso THEN DELETE FROM atacado_capacidades WHERE id = v_id AND empresa_id = v_emp; END IF;

  ELSIF p_lista = 'cor' THEN
    v_id := p_chave::uuid;
    SELECT cor INTO v_nome FROM atacado_modelo_cores WHERE id = v_id AND empresa_id = v_emp;
    SELECT EXISTS(SELECT 1 FROM atacado_aparelhos WHERE empresa_id = v_emp AND cor = v_nome) INTO v_em_uso;
    IF NOT v_em_uso THEN DELETE FROM atacado_modelo_cores WHERE id = v_id AND empresa_id = v_emp; END IF;

  ELSIF p_lista = 'grade' THEN
    v_id := p_chave::uuid;
    SELECT nome INTO v_nome FROM atacado_grades WHERE id = v_id AND empresa_id = v_emp;
    SELECT EXISTS(SELECT 1 FROM atacado_aparelhos WHERE empresa_id = v_emp AND grade = v_nome) INTO v_em_uso;
    IF NOT v_em_uso THEN DELETE FROM atacado_grades WHERE id = v_id AND empresa_id = v_emp; END IF;

  ELSIF p_lista = 'condicao' THEN
    v_id := p_chave::uuid;
    SELECT nome INTO v_nome FROM atacado_condicoes WHERE id = v_id AND empresa_id = v_emp;
    SELECT EXISTS(SELECT 1 FROM atacado_aparelhos WHERE empresa_id = v_emp AND condicao = v_nome) INTO v_em_uso;
    IF NOT v_em_uso THEN DELETE FROM atacado_condicoes WHERE id = v_id AND empresa_id = v_emp; END IF;

  ELSIF p_lista = 'status' THEN
    v_id := p_chave::uuid;
    SELECT nome INTO v_nome FROM atacado_status_aparelho WHERE id = v_id AND empresa_id = v_emp;
    SELECT EXISTS(SELECT 1 FROM atacado_aparelhos WHERE empresa_id = v_emp AND status = v_nome) INTO v_em_uso;
    IF NOT v_em_uso THEN DELETE FROM atacado_status_aparelho WHERE id = v_id AND empresa_id = v_emp; END IF;

  ELSIF p_lista = 'tipo_assist' THEN
    v_id := p_chave::uuid;
    SELECT nome INTO v_nome FROM atacado_tipos_assistencia WHERE id = v_id AND empresa_id = v_emp;
    SELECT (EXISTS(SELECT 1 FROM atacado_aparelho_assistencias WHERE empresa_id = v_emp AND tipo_nome = v_nome)
         OR EXISTS(SELECT 1 FROM atacado_modelo_assistencias  WHERE empresa_id = v_emp AND tipo_id = v_id))
      INTO v_em_uso;
    IF NOT v_em_uso THEN DELETE FROM atacado_tipos_assistencia WHERE id = v_id AND empresa_id = v_emp; END IF;

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'lista_invalida');
  END IF;

  IF v_em_uso THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'em_uso',
      'message', 'Este item já foi usado e não pode ser excluído. Desative-o.'
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.atacado_excluir_item(text, text) TO authenticated;