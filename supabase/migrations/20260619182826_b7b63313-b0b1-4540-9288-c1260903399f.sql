
-- ============================================================
-- ATACADO-LEILAO-01: Ofertas (negociação) no catálogo público
-- ============================================================

-- 1) TABLES
CREATE TABLE public.atacado_ofertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  catalogo_slug text NOT NULL,
  aparelho_id uuid NULL,
  modelo text,
  capacidade text,
  cor text,
  grade text,
  condicao text,
  quantidade int NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  valor_oferta numeric(14,2) NOT NULL CHECK (valor_oferta > 0),
  cliente_nome text NOT NULL,
  cliente_contato text NOT NULL,
  mensagem text NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','contraoferta','aceita','recusada','expirada','finalizada')),
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ofertas_empresa ON public.atacado_ofertas(empresa_id, status, created_at DESC);
CREATE INDEX idx_ofertas_slug ON public.atacado_ofertas(catalogo_slug);

CREATE TABLE public.atacado_ofertas_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id uuid NOT NULL REFERENCES public.atacado_ofertas(id) ON DELETE CASCADE,
  autor text NOT NULL CHECK (autor IN ('cliente','vendedor')),
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  mensagem text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ofertas_rounds_oferta ON public.atacado_ofertas_rounds(oferta_id, created_at);

-- 2) GRANTS (sem anon — acesso anônimo é só via RPCs SECURITY DEFINER)
GRANT SELECT, UPDATE ON public.atacado_ofertas TO authenticated;
GRANT ALL ON public.atacado_ofertas TO service_role;
GRANT SELECT ON public.atacado_ofertas_rounds TO authenticated;
GRANT ALL ON public.atacado_ofertas_rounds TO service_role;

-- 3) RLS
ALTER TABLE public.atacado_ofertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atacado_ofertas_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ofertas_select_empresa" ON public.atacado_ofertas
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_my_empresa_id());

CREATE POLICY "ofertas_update_empresa" ON public.atacado_ofertas
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_my_empresa_id())
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE POLICY "ofertas_rounds_select_empresa" ON public.atacado_ofertas_rounds
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.atacado_ofertas o
    WHERE o.id = oferta_id AND o.empresa_id = public.get_my_empresa_id()
  ));

-- 4) Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_atacado_ofertas_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_ofertas_updated_at BEFORE UPDATE ON public.atacado_ofertas
  FOR EACH ROW EXECUTE FUNCTION public.tg_atacado_ofertas_updated_at();

-- ============================================================
-- 5) RPC: criar oferta (anônimo) ---------------------------------
-- ============================================================
CREATE OR REPLACE FUNCTION public.catalogo_criar_oferta(
  p_slug text,
  p_modelo text,
  p_capacidade text,
  p_cor text,
  p_grade text,
  p_condicao text,
  p_aparelho_id uuid,
  p_quantidade int,
  p_valor numeric,
  p_nome text,
  p_contato text,
  p_mensagem text DEFAULT NULL
) RETURNS TABLE(oferta_id uuid, token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_empresa uuid; v_ativo boolean; v_modo text; v_id uuid; v_token uuid;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF coalesce(trim(p_nome),'') = '' OR coalesce(trim(p_contato),'') = '' THEN
    RAISE EXCEPTION 'Nome e contato obrigatórios';
  END IF;

  SELECT empresa_id, catalogo_publico_ativo, catalogo_modo
    INTO v_empresa, v_ativo, v_modo
  FROM atacado_configuracoes WHERE catalogo_publico_slug = p_slug LIMIT 1;

  IF v_empresa IS NULL OR v_ativo IS NOT TRUE THEN
    RAISE EXCEPTION 'Catálogo indisponível';
  END IF;

  INSERT INTO atacado_ofertas (
    empresa_id, catalogo_slug, aparelho_id, modelo, capacidade, cor, grade, condicao,
    quantidade, valor_oferta, cliente_nome, cliente_contato, mensagem, status
  ) VALUES (
    v_empresa, p_slug, p_aparelho_id, p_modelo, p_capacidade, p_cor, p_grade, p_condicao,
    p_quantidade, p_valor, left(trim(p_nome),120), left(trim(p_contato),120),
    nullif(left(trim(coalesce(p_mensagem,'')),500),''), 'pendente'
  )
  RETURNING id, token INTO v_id, v_token;

  INSERT INTO atacado_ofertas_rounds (oferta_id, autor, valor, mensagem)
  VALUES (v_id, 'cliente', p_valor, nullif(left(trim(coalesce(p_mensagem,'')),500),''));

  RETURN QUERY SELECT v_id, v_token;
END;
$$;

-- ============================================================
-- 6) RPC: ler oferta por token (anônimo)
-- ============================================================
CREATE OR REPLACE FUNCTION public.catalogo_get_oferta(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_o atacado_ofertas%ROWTYPE; v_rounds jsonb;
BEGIN
  SELECT * INTO v_o FROM atacado_ofertas WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oferta não encontrada'; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'autor', autor, 'valor', valor,
    'mensagem', mensagem, 'created_at', created_at
  ) ORDER BY created_at), '[]'::jsonb)
  INTO v_rounds FROM atacado_ofertas_rounds WHERE oferta_id = v_o.id;

  RETURN jsonb_build_object(
    'id', v_o.id,
    'status', v_o.status,
    'modelo', v_o.modelo,
    'capacidade', v_o.capacidade,
    'cor', v_o.cor,
    'grade', v_o.grade,
    'condicao', v_o.condicao,
    'quantidade', v_o.quantidade,
    'valor_oferta', v_o.valor_oferta,
    'cliente_nome', v_o.cliente_nome,
    'cliente_contato', v_o.cliente_contato,
    'expires_at', v_o.expires_at,
    'created_at', v_o.created_at,
    'updated_at', v_o.updated_at,
    'rounds', v_rounds
  );
END;
$$;

-- ============================================================
-- 7) RPC: cliente responde (anônimo via token)
-- ============================================================
CREATE OR REPLACE FUNCTION public.catalogo_responder_oferta_cliente(
  p_token uuid,
  p_acao text,
  p_valor numeric DEFAULT NULL,
  p_msg text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_o atacado_ofertas%ROWTYPE; v_novo_status text; v_valor numeric;
BEGIN
  SELECT * INTO v_o FROM atacado_ofertas WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oferta não encontrada'; END IF;
  IF v_o.status IN ('aceita','recusada','expirada','finalizada') THEN
    RAISE EXCEPTION 'Oferta já encerrada (status: %)', v_o.status;
  END IF;
  IF v_o.expires_at < now() THEN
    UPDATE atacado_ofertas SET status='expirada' WHERE id=v_o.id;
    RAISE EXCEPTION 'Oferta expirada';
  END IF;

  IF p_acao = 'aceitar' THEN
    -- aceita a contraoferta atual do vendedor
    v_valor := v_o.valor_oferta;
    v_novo_status := 'aceita';
  ELSIF p_acao = 'recusar' THEN
    v_valor := v_o.valor_oferta;
    v_novo_status := 'recusada';
  ELSIF p_acao = 'contraofertar' THEN
    IF p_valor IS NULL OR p_valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
    v_valor := p_valor;
    v_novo_status := 'pendente';
  ELSE
    RAISE EXCEPTION 'Ação inválida';
  END IF;

  INSERT INTO atacado_ofertas_rounds (oferta_id, autor, valor, mensagem)
  VALUES (v_o.id, 'cliente', v_valor, nullif(left(trim(coalesce(p_msg,'')),500),''));

  UPDATE atacado_ofertas
     SET status = v_novo_status,
         valor_oferta = CASE WHEN p_acao = 'contraofertar' THEN v_valor ELSE valor_oferta END
   WHERE id = v_o.id;

  RETURN jsonb_build_object('status', v_novo_status, 'valor', v_valor);
END;
$$;

-- ============================================================
-- 8) RPC: finalizar oferta (anônimo, após fechar no WhatsApp)
-- ============================================================
CREATE OR REPLACE FUNCTION public.catalogo_finalizar_oferta(p_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE atacado_ofertas
     SET status = 'finalizada'
   WHERE token = p_token AND status IN ('aceita','contraoferta','pendente');
END;
$$;

-- ============================================================
-- 9) RPC: vendedor responde (autenticado, escopado à empresa)
-- ============================================================
CREATE OR REPLACE FUNCTION public.oferta_responder_vendedor(
  p_oferta_id uuid,
  p_acao text,
  p_valor numeric DEFAULT NULL,
  p_msg text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_o atacado_ofertas%ROWTYPE; v_novo_status text; v_valor numeric;
        v_minha uuid;
BEGIN
  v_minha := public.get_my_empresa_id();
  IF v_minha IS NULL THEN RAISE EXCEPTION 'Sem empresa'; END IF;

  SELECT * INTO v_o FROM atacado_ofertas WHERE id = p_oferta_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Oferta não encontrada'; END IF;
  IF v_o.empresa_id <> v_minha THEN RAISE EXCEPTION 'Sem acesso a esta oferta'; END IF;
  IF v_o.status IN ('aceita','recusada','expirada','finalizada') THEN
    RAISE EXCEPTION 'Oferta já encerrada (status: %)', v_o.status;
  END IF;

  IF p_acao = 'aceitar' THEN
    v_valor := v_o.valor_oferta; v_novo_status := 'aceita';
  ELSIF p_acao = 'recusar' THEN
    v_valor := v_o.valor_oferta; v_novo_status := 'recusada';
  ELSIF p_acao = 'contraofertar' THEN
    IF p_valor IS NULL OR p_valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
    v_valor := p_valor; v_novo_status := 'contraoferta';
  ELSE
    RAISE EXCEPTION 'Ação inválida';
  END IF;

  INSERT INTO atacado_ofertas_rounds (oferta_id, autor, valor, mensagem)
  VALUES (v_o.id, 'vendedor', v_valor, nullif(left(trim(coalesce(p_msg,'')),500),''));

  UPDATE atacado_ofertas
     SET status = v_novo_status,
         valor_oferta = CASE WHEN p_acao = 'contraofertar' THEN v_valor ELSE valor_oferta END
   WHERE id = v_o.id;

  RETURN jsonb_build_object('status', v_novo_status, 'valor', v_valor);
END;
$$;

-- ============================================================
-- 10) Permissões de execução
-- ============================================================
REVOKE ALL ON FUNCTION public.catalogo_criar_oferta(text,text,text,text,text,text,uuid,int,numeric,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_criar_oferta(text,text,text,text,text,text,uuid,int,numeric,text,text,text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.catalogo_get_oferta(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_get_oferta(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.catalogo_responder_oferta_cliente(uuid,text,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_responder_oferta_cliente(uuid,text,numeric,text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.catalogo_finalizar_oferta(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_finalizar_oferta(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.oferta_responder_vendedor(uuid,text,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oferta_responder_vendedor(uuid,text,numeric,text) TO authenticated;
