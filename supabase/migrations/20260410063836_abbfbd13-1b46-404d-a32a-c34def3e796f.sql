
CREATE OR REPLACE FUNCTION public.gerar_comissao_automatica()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_cs record;
  v_func record;
  v_valor_comissao numeric;
  v_tipo text;
  v_servico_nome text;
  v_already_exists boolean;
BEGIN
  IF NEW.status = 'pronto' AND OLD.status IS DISTINCT FROM 'pronto' AND NEW.funcionario_id IS NOT NULL THEN
    -- Check for existing commission on this OS (prevent duplicates)
    SELECT EXISTS (
      SELECT 1 FROM public.comissoes WHERE ordem_id = NEW.id
    ) INTO v_already_exists;

    IF v_already_exists THEN
      RETURN NEW;
    END IF;

    -- Get service name for observacoes
    IF NEW.tipo_servico_id IS NOT NULL THEN
      SELECT nome INTO v_servico_nome FROM public.tipos_servico WHERE id = NEW.tipo_servico_id;
    END IF;

    -- 1) Try per-service commission
    IF NEW.tipo_servico_id IS NOT NULL THEN
      SELECT tipo_comissao, valor INTO v_cs
      FROM public.comissoes_servico
      WHERE funcionario_id = NEW.funcionario_id
        AND tipo_servico_id = NEW.tipo_servico_id;
    END IF;

    IF v_cs IS NOT NULL AND v_cs.valor > 0 THEN
      IF v_cs.tipo_comissao = 'percentual' THEN
        v_valor_comissao := COALESCE(NEW.valor, 0) * v_cs.valor / 100;
      ELSE
        v_valor_comissao := v_cs.valor;
      END IF;
      v_tipo := v_cs.tipo_comissao::text;
    ELSE
      -- 2) Fallback to default employee commission
      SELECT tipo_comissao, valor_comissao INTO v_func
      FROM public.funcionarios
      WHERE id = NEW.funcionario_id AND ativo = true;

      IF NOT FOUND OR v_func.valor_comissao <= 0 THEN
        RETURN NEW;
      END IF;

      IF v_func.tipo_comissao = 'percentual' THEN
        v_valor_comissao := COALESCE(NEW.valor, 0) * v_func.valor_comissao / 100;
      ELSE
        v_valor_comissao := v_func.valor_comissao;
      END IF;
      v_tipo := v_func.tipo_comissao::text;
    END IF;

    INSERT INTO public.comissoes (funcionario_id, ordem_id, valor, valor_base, tipo, status, observacoes)
    VALUES (
      NEW.funcionario_id,
      NEW.id,
      v_valor_comissao,
      COALESCE(NEW.valor, 0),
      v_tipo,
      'pendente',
      CASE WHEN v_servico_nome IS NOT NULL THEN 'Serviço: ' || v_servico_nome ELSE NULL END
    );
  END IF;
  RETURN NEW;
END;
$$;
