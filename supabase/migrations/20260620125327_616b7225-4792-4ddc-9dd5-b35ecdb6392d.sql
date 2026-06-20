-- Migration: contas_bancarias_base_ledger
CREATE TABLE IF NOT EXISTS public.contas_bancarias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  nome          text NOT NULL,
  tipo          text NOT NULL DEFAULT 'corrente'
                  CHECK (tipo IN ('corrente','poupanca','caixa','maquininha','outro')),
  instituicao   text NULL,
  cor           text NULL,
  saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  ativa         boolean NOT NULL DEFAULT true,
  ordem         int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz NULL
);
CREATE INDEX IF NOT EXISTS idx_contas_bancarias_empresa
  ON public.contas_bancarias(empresa_id, ativa) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.conta_movimentacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  conta_id        uuid NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE CASCADE,
  tipo            text NOT NULL
                    CHECK (tipo IN ('entrada','saida','transferencia','ajuste')),
  valor           numeric(14,2) NOT NULL CHECK (valor <> 0),
  descricao       text NULL,
  data            date NOT NULL DEFAULT current_date,
  origem          text NULL,
  origem_id       uuid NULL,
  transfer_par_id uuid NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conta_mov_conta
  ON public.conta_movimentacoes(conta_id, data DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conta_mov_empresa
  ON public.conta_movimentacoes(empresa_id);

GRANT SELECT ON public.contas_bancarias  TO authenticated;
GRANT SELECT ON public.conta_movimentacoes TO authenticated;
GRANT ALL ON public.contas_bancarias  TO service_role;
GRANT ALL ON public.conta_movimentacoes TO service_role;

ALTER TABLE public.contas_bancarias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conta_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contas_bancarias_select" ON public.contas_bancarias
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id() AND deleted_at IS NULL);

CREATE POLICY "conta_mov_select" ON public.conta_movimentacoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

CREATE OR REPLACE FUNCTION public.tg_contas_bancarias_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_contas_bancarias_updated_at ON public.contas_bancarias;
CREATE TRIGGER trg_contas_bancarias_updated_at
  BEFORE UPDATE ON public.contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.tg_contas_bancarias_updated_at();

CREATE OR REPLACE FUNCTION public.contas_bancarias_listar(p_incluir_inativas boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_out jsonb;
BEGIN
  v_emp := public.get_my_empresa_id();
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sem empresa'); END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'ordem', x->>'nome'), '[]'::jsonb) INTO v_out
  FROM (
    SELECT jsonb_build_object(
      'id', c.id, 'nome', c.nome, 'tipo', c.tipo, 'instituicao', c.instituicao,
      'cor', c.cor, 'ativa', c.ativa, 'ordem', c.ordem,
      'saldo_inicial', c.saldo_inicial,
      'saldo', c.saldo_inicial + coalesce(m.soma, 0)
    ) AS x
    FROM public.contas_bancarias c
    LEFT JOIN (
      SELECT conta_id, sum(valor) AS soma
      FROM public.conta_movimentacoes
      WHERE empresa_id = v_emp
      GROUP BY conta_id
    ) m ON m.conta_id = c.id
    WHERE c.empresa_id = v_emp AND c.deleted_at IS NULL
      AND (p_incluir_inativas OR c.ativa = true)
  ) t;

  RETURN jsonb_build_object('success', true, 'data', v_out);
END;
$$;

CREATE OR REPLACE FUNCTION public.conta_bancaria_criar(
  p_nome text, p_tipo text, p_instituicao text, p_cor text, p_saldo_inicial numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_id uuid;
BEGIN
  v_emp := public.get_my_empresa_id();
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sem empresa'); END IF;
  IF coalesce(trim(p_nome),'') = '' THEN RETURN jsonb_build_object('success', false, 'error', 'Nome obrigatório'); END IF;

  INSERT INTO public.contas_bancarias (empresa_id, nome, tipo, instituicao, cor, saldo_inicial)
  VALUES (v_emp, left(trim(p_nome),80), coalesce(p_tipo,'corrente'),
          nullif(trim(coalesce(p_instituicao,'')),''), nullif(trim(coalesce(p_cor,'')),''),
          coalesce(p_saldo_inicial,0))
  RETURNING contas_bancarias.id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.conta_bancaria_editar(
  p_id uuid, p_nome text, p_tipo text, p_instituicao text, p_cor text, p_ativa boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid;
BEGIN
  v_emp := public.get_my_empresa_id();
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sem empresa'); END IF;

  UPDATE public.contas_bancarias
     SET nome = coalesce(nullif(trim(p_nome),''), nome),
         tipo = coalesce(p_tipo, tipo),
         instituicao = nullif(trim(coalesce(p_instituicao,'')),''),
         cor = nullif(trim(coalesce(p_cor,'')),''),
         ativa = coalesce(p_ativa, ativa)
   WHERE id = p_id AND empresa_id = v_emp AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Conta não encontrada'); END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.conta_bancaria_arquivar(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid;
BEGIN
  v_emp := public.get_my_empresa_id();
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sem empresa'); END IF;
  UPDATE public.contas_bancarias SET deleted_at = now(), ativa = false
   WHERE id = p_id AND empresa_id = v_emp AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Conta não encontrada'); END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.conta_lancar_movimentacao(
  p_conta_id uuid, p_tipo text, p_valor numeric, p_descricao text, p_data date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_sign numeric;
BEGIN
  v_emp := public.get_my_empresa_id();
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sem empresa'); END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Valor inválido'); END IF;
  IF p_tipo NOT IN ('entrada','saida') THEN RETURN jsonb_build_object('success', false, 'error', 'Tipo inválido'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contas_bancarias WHERE id = p_conta_id AND empresa_id = v_emp AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta não encontrada');
  END IF;

  v_sign := CASE WHEN p_tipo = 'entrada' THEN 1 ELSE -1 END;
  INSERT INTO public.conta_movimentacoes (empresa_id, conta_id, tipo, valor, descricao, data, origem)
  VALUES (v_emp, p_conta_id, p_tipo, round(p_valor,2) * v_sign,
          nullif(trim(coalesce(p_descricao,'')),''), coalesce(p_data, current_date), 'manual');

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.conta_transferir(
  p_origem_id uuid, p_destino_id uuid, p_valor numeric, p_descricao text, p_data date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_a uuid; v_b uuid; v_val numeric; v_dt date; v_desc text;
BEGIN
  v_emp := public.get_my_empresa_id();
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sem empresa'); END IF;
  IF p_origem_id = p_destino_id THEN RETURN jsonb_build_object('success', false, 'error', 'Contas iguais'); END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Valor inválido'); END IF;
  IF (SELECT count(*) FROM public.contas_bancarias
        WHERE id IN (p_origem_id, p_destino_id) AND empresa_id = v_emp AND deleted_at IS NULL) <> 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta inválida');
  END IF;

  v_val := round(p_valor,2);
  v_dt := coalesce(p_data, current_date);
  v_desc := nullif(trim(coalesce(p_descricao,'')),'');
  v_a := gen_random_uuid(); v_b := gen_random_uuid();

  INSERT INTO public.conta_movimentacoes (id, empresa_id, conta_id, tipo, valor, descricao, data, origem, transfer_par_id)
  VALUES (v_a, v_emp, p_origem_id,  'transferencia', -v_val, v_desc, v_dt, 'transferencia', v_b),
         (v_b, v_emp, p_destino_id, 'transferencia',  v_val, v_desc, v_dt, 'transferencia', v_a);

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.conta_ajustar_saldo(
  p_conta_id uuid, p_novo_saldo numeric, p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_atual numeric; v_delta numeric;
BEGIN
  v_emp := public.get_my_empresa_id();
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sem empresa'); END IF;
  IF p_novo_saldo IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Saldo inválido'); END IF;

  SELECT c.saldo_inicial + coalesce(sum(m.valor),0)
    INTO v_atual
  FROM public.contas_bancarias c
  LEFT JOIN public.conta_movimentacoes m ON m.conta_id = c.id AND m.empresa_id = v_emp
  WHERE c.id = p_conta_id AND c.empresa_id = v_emp AND c.deleted_at IS NULL
  GROUP BY c.saldo_inicial;

  IF v_atual IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Conta não encontrada'); END IF;

  v_delta := round(p_novo_saldo,2) - v_atual;
  IF v_delta = 0 THEN RETURN jsonb_build_object('success', true, 'sem_ajuste', true); END IF;

  INSERT INTO public.conta_movimentacoes (empresa_id, conta_id, tipo, valor, descricao, data, origem)
  VALUES (v_emp, p_conta_id, 'ajuste', v_delta,
          coalesce(nullif(trim(coalesce(p_motivo,'')),''), 'Ajuste de saldo'), current_date, 'ajuste');

  RETURN jsonb_build_object('success', true, 'delta', v_delta);
END;
$$;

CREATE OR REPLACE FUNCTION public.conta_extrato(
  p_conta_id uuid, p_limit int DEFAULT 100, p_offset int DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_base numeric; v_out jsonb;
BEGIN
  v_emp := public.get_my_empresa_id();
  IF v_emp IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sem empresa'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contas_bancarias WHERE id = p_conta_id AND empresa_id = v_emp AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conta não encontrada');
  END IF;

  SELECT saldo_inicial INTO v_base FROM public.contas_bancarias WHERE id = p_conta_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'tipo', t.tipo, 'valor', t.valor, 'descricao', t.descricao,
           'data', t.data, 'origem', t.origem, 'saldo_apos', v_base + t.saldo_corrido
         ) ORDER BY t.data DESC, t.created_at DESC), '[]'::jsonb)
    INTO v_out
  FROM (
    SELECT m.id, m.tipo, m.valor, m.descricao, m.data, m.origem, m.created_at,
           sum(m.valor) OVER (ORDER BY m.data, m.created_at
                              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS saldo_corrido
    FROM public.conta_movimentacoes m
    WHERE m.conta_id = p_conta_id AND m.empresa_id = v_emp
    ORDER BY m.data DESC, m.created_at DESC
    LIMIT greatest(p_limit,1) OFFSET greatest(p_offset,0)
  ) t;

  RETURN jsonb_build_object('success', true, 'data', v_out);
END;
$$;

GRANT EXECUTE ON FUNCTION public.contas_bancarias_listar(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conta_bancaria_criar(text,text,text,text,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conta_bancaria_editar(uuid,text,text,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conta_bancaria_arquivar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conta_lancar_movimentacao(uuid,text,numeric,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conta_transferir(uuid,uuid,numeric,text,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conta_ajustar_saldo(uuid,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conta_extrato(uuid,int,int) TO authenticated;
