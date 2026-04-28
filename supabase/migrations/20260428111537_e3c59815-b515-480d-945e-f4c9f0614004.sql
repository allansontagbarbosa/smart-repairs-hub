CREATE TABLE IF NOT EXISTS public.lojista_faturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lojista_id uuid NOT NULL REFERENCES public.lojistas(id),
  empresa_id uuid NOT NULL,
  mes_competencia text NOT NULL,
  status text NOT NULL DEFAULT 'aberta',
  total_servicos numeric NOT NULL DEFAULT 0,
  total_pecas numeric NOT NULL DEFAULT 0,
  total_geral numeric NOT NULL DEFAULT 0,
  data_emissao timestamptz,
  data_pagamento timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lojista_id, mes_competencia)
);

ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS fatura_id uuid REFERENCES public.lojista_faturas(id);

ALTER TABLE public.movimentacoes_financeiras
  ADD COLUMN IF NOT EXISTS lojista_fatura_id uuid REFERENCES public.lojista_faturas(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mov_fin_lojista_fatura_entrada_ativa
  ON public.movimentacoes_financeiras (lojista_fatura_id)
  WHERE lojista_fatura_id IS NOT NULL
    AND tipo = 'entrada'::public.tipo_movimentacao
    AND estornada_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_lojista_faturas_empresa_mes
  ON public.lojista_faturas (empresa_id, mes_competencia DESC);

CREATE INDEX IF NOT EXISTS idx_lojista_faturas_lojista_mes
  ON public.lojista_faturas (lojista_id, mes_competencia DESC);

CREATE INDEX IF NOT EXISTS idx_ordens_de_servico_fatura_id
  ON public.ordens_de_servico (fatura_id);

ALTER TABLE public.lojista_faturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fatura_select_empresa" ON public.lojista_faturas;
DROP POLICY IF EXISTS "fatura_insert_empresa" ON public.lojista_faturas;
DROP POLICY IF EXISTS "fatura_update_empresa" ON public.lojista_faturas;
DROP POLICY IF EXISTS "fatura_delete_empresa" ON public.lojista_faturas;

CREATE POLICY "fatura_select_empresa"
  ON public.lojista_faturas
  FOR SELECT
  USING (empresa_id = public.get_my_empresa_id());

CREATE POLICY "fatura_insert_empresa"
  ON public.lojista_faturas
  FOR INSERT
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE POLICY "fatura_update_empresa"
  ON public.lojista_faturas
  FOR UPDATE
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE OR REPLACE FUNCTION public.validar_mes_competencia_fatura()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.mes_competencia !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'Mês de competência deve estar no formato YYYY-MM';
  END IF;

  IF NEW.status NOT IN ('aberta', 'fechada', 'paga', 'cancelada') THEN
    RAISE EXCEPTION 'Status de fatura inválido: %', NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_mes_competencia_fatura ON public.lojista_faturas;
CREATE TRIGGER trg_validar_mes_competencia_fatura
  BEFORE INSERT OR UPDATE ON public.lojista_faturas
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_mes_competencia_fatura();

DROP TRIGGER IF EXISTS trg_lojista_faturas_updated_at ON public.lojista_faturas;
CREATE TRIGGER trg_lojista_faturas_updated_at
  BEFORE UPDATE ON public.lojista_faturas
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE OR REPLACE FUNCTION public.gerar_ou_atualizar_fatura_lojista(p_lojista_id uuid, p_mes text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fatura_id uuid;
  v_empresa_id uuid;
  v_total_servicos numeric := 0;
  v_total_pecas numeric := 0;
BEGIN
  IF p_lojista_id IS NULL THEN
    RAISE EXCEPTION 'Lojista é obrigatório para gerar fatura';
  END IF;

  IF p_mes IS NULL OR p_mes !~ '^[0-9]{4}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'Mês de competência deve estar no formato YYYY-MM';
  END IF;

  SELECT empresa_id
    INTO v_empresa_id
    FROM public.lojistas
    WHERE id = p_lojista_id
      AND deleted_at IS NULL;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Lojista não encontrado ou sem empresa vinculada';
  END IF;

  SELECT
    COALESCE(SUM(valor_total_servicos), 0),
    COALESCE(SUM(custo_pecas), 0)
  INTO v_total_servicos, v_total_pecas
  FROM public.ordens_de_servico
  WHERE lojista_id = p_lojista_id
    AND status::text = 'entregue'
    AND to_char(COALESCE(data_conclusao, data_entrega), 'YYYY-MM') = p_mes
    AND deleted_at IS NULL;

  INSERT INTO public.lojista_faturas (
    lojista_id,
    empresa_id,
    mes_competencia,
    total_servicos,
    total_pecas,
    total_geral
  ) VALUES (
    p_lojista_id,
    v_empresa_id,
    p_mes,
    v_total_servicos,
    v_total_pecas,
    v_total_servicos + v_total_pecas
  )
  ON CONFLICT (lojista_id, mes_competencia)
  DO UPDATE SET
    total_servicos = EXCLUDED.total_servicos,
    total_pecas = EXCLUDED.total_pecas,
    total_geral = EXCLUDED.total_geral,
    updated_at = now()
  WHERE public.lojista_faturas.status IN ('aberta', 'fechada')
  RETURNING id INTO v_fatura_id;

  IF v_fatura_id IS NULL THEN
    SELECT id INTO v_fatura_id
    FROM public.lojista_faturas
    WHERE lojista_id = p_lojista_id
      AND mes_competencia = p_mes;
  END IF;

  UPDATE public.ordens_de_servico
  SET fatura_id = v_fatura_id
  WHERE lojista_id = p_lojista_id
    AND status::text = 'entregue'
    AND to_char(COALESCE(data_conclusao, data_entrega), 'YYYY-MM') = p_mes
    AND deleted_at IS NULL
    AND (fatura_id IS NULL OR fatura_id = v_fatura_id);

  RETURN v_fatura_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_movimentacao_pagamento_fatura_lojista()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lojista_nome text;
BEGIN
  IF NEW.status = 'paga' AND OLD.status IS DISTINCT FROM 'paga' THEN
    SELECT nome INTO v_lojista_nome
    FROM public.lojistas
    WHERE id = NEW.lojista_id;

    NEW.data_pagamento := COALESCE(NEW.data_pagamento, now());

    INSERT INTO public.movimentacoes_financeiras (
      tipo,
      descricao,
      valor,
      empresa_id,
      data,
      lojista_fatura_id
    ) VALUES (
      'entrada'::public.tipo_movimentacao,
      'Fatura lojista ' || COALESCE(v_lojista_nome, NEW.lojista_id::text) || ' - ' || NEW.mes_competencia,
      NEW.total_geral,
      NEW.empresa_id,
      NEW.data_pagamento,
      NEW.id
    )
    ON CONFLICT (lojista_fatura_id)
    WHERE lojista_fatura_id IS NOT NULL
      AND tipo = 'entrada'::public.tipo_movimentacao
      AND estornada_em IS NULL
    DO NOTHING;
  END IF;

  IF OLD.status = 'paga' AND NEW.status IS DISTINCT FROM 'paga' THEN
    UPDATE public.movimentacoes_financeiras
    SET estornada_em = COALESCE(estornada_em, now())
    WHERE lojista_fatura_id = NEW.id
      AND tipo = 'entrada'::public.tipo_movimentacao
      AND estornada_em IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pagamento_fatura_lojista ON public.lojista_faturas;
CREATE TRIGGER trg_pagamento_fatura_lojista
  BEFORE UPDATE OF status ON public.lojista_faturas
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_movimentacao_pagamento_fatura_lojista();

CREATE OR REPLACE FUNCTION public.gerar_comissao_automatica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_servico record;
  v_mes_competencia text;
BEGIN
  IF NEW.status::text = 'entregue' AND OLD.status::text IS DISTINCT FROM 'entregue' THEN
    v_mes_competencia := to_char(COALESCE(NEW.data_conclusao, NEW.data_entrega, now()), 'YYYY-MM');

    IF NEW.funcionario_id IS NOT NULL THEN
      FOR v_servico IN
        SELECT id, nome, comissao
        FROM public.os_servicos
        WHERE ordem_id = NEW.id
          AND COALESCE(comissao, 0) > 0
      LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM public.comissoes
          WHERE ordem_id = NEW.id
            AND os_servico_id = v_servico.id
            AND funcionario_id = NEW.funcionario_id
            AND estornada_em IS NULL
        ) THEN
          INSERT INTO public.comissoes (
            funcionario_id,
            ordem_id,
            os_servico_id,
            empresa_id,
            valor,
            valor_base,
            tipo,
            status,
            observacoes,
            mes_competencia
          ) VALUES (
            NEW.funcionario_id,
            NEW.id,
            v_servico.id,
            NEW.empresa_id,
            v_servico.comissao,
            NULL,
            'fixa',
            'pendente',
            'Serviço: ' || v_servico.nome,
            v_mes_competencia
          );
        END IF;
      END LOOP;
    END IF;

    IF NEW.lojista_id IS NOT NULL THEN
      PERFORM public.gerar_ou_atualizar_fatura_lojista(NEW.lojista_id, v_mes_competencia);
    ELSIF COALESCE(NEW.valor_total, 0) > 0
       AND NOT EXISTS (
         SELECT 1
         FROM public.movimentacoes_financeiras
         WHERE ordem_id = NEW.id
           AND tipo = 'entrada'::public.tipo_movimentacao
           AND estornada_em IS NULL
       ) THEN
      INSERT INTO public.movimentacoes_financeiras (
        tipo,
        descricao,
        valor,
        ordem_id,
        empresa_id,
        data
      ) VALUES (
        'entrada'::public.tipo_movimentacao,
        'Recebimento OS #' || COALESCE(NEW.numero_formatado, NEW.numero::text),
        NEW.valor_total,
        NEW.id,
        NEW.empresa_id,
        COALESCE(NEW.data_entrega, now())
      );
    END IF;
  END IF;

  IF OLD.status::text = 'entregue' AND NEW.status::text IS DISTINCT FROM 'entregue' THEN
    UPDATE public.comissoes
    SET status = 'estornada'::public.status_comissao,
        estornada_em = COALESCE(estornada_em, now()),
        updated_at = now()
    WHERE ordem_id = NEW.id
      AND estornada_em IS NULL;

    UPDATE public.movimentacoes_financeiras
    SET estornada_em = COALESCE(estornada_em, now())
    WHERE ordem_id = NEW.id
      AND tipo = 'entrada'::public.tipo_movimentacao
      AND estornada_em IS NULL;

    IF OLD.lojista_id IS NOT NULL THEN
      PERFORM public.gerar_ou_atualizar_fatura_lojista(
        OLD.lojista_id,
        to_char(COALESCE(OLD.data_conclusao, OLD.data_entrega, now()), 'YYYY-MM')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;