-- 1) TABELAS
CREATE TABLE IF NOT EXISTS public.solicitacoes_lancamento (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  criada_por       uuid NOT NULL REFERENCES auth.users(id),
  criada_por_socio uuid NOT NULL REFERENCES public.socios(id) ON DELETE RESTRICT,
  socio_destino    uuid NOT NULL REFERENCES public.socios(id) ON DELETE RESTRICT,
  tipo             text NOT NULL CHECK (tipo IN ('credito','debito','pro_labore','ajuste')),
  valor            numeric(14,2) NOT NULL CHECK (valor > 0),
  data_referencia  date NOT NULL,
  descricao        text NOT NULL,
  status           text NOT NULL DEFAULT 'aguardando_aprovacao'
                     CHECK (status IN ('aguardando_aprovacao','aprovado','rejeitado','cancelado')),
  extrato_id       uuid REFERENCES public.extrato_socio(id) ON DELETE SET NULL,
  finalizada_em    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_solicit_empresa_status ON public.solicitacoes_lancamento(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_solicit_destino ON public.solicitacoes_lancamento(socio_destino);

GRANT SELECT ON public.solicitacoes_lancamento TO authenticated;
GRANT ALL ON public.solicitacoes_lancamento TO service_role;

CREATE TABLE IF NOT EXISTS public.aprovacoes_lancamento (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id  uuid NOT NULL REFERENCES public.solicitacoes_lancamento(id) ON DELETE CASCADE,
  socio_id        uuid NOT NULL REFERENCES public.socios(id) ON DELETE RESTRICT,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  voto            text NOT NULL CHECK (voto IN ('aprovado','rejeitado')),
  motivo          text,
  votado_em       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aprovacao_unica_por_socio UNIQUE (solicitacao_id, socio_id)
);
CREATE INDEX IF NOT EXISTS idx_aprov_solicit ON public.aprovacoes_lancamento(solicitacao_id);

GRANT SELECT ON public.aprovacoes_lancamento TO authenticated;
GRANT ALL ON public.aprovacoes_lancamento TO service_role;

CREATE TABLE IF NOT EXISTS public.notificacoes_socio (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  socio_id       uuid NOT NULL REFERENCES public.socios(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id),
  tipo           text NOT NULL,
  titulo         text NOT NULL,
  mensagem       text NOT NULL,
  link_interno   text,
  ref_id         uuid,
  lida           boolean NOT NULL DEFAULT false,
  lida_em        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user_lida ON public.notificacoes_socio(user_id, lida, created_at DESC);

GRANT SELECT ON public.notificacoes_socio TO authenticated;
GRANT ALL ON public.notificacoes_socio TO service_role;

-- 2) RPC: solicitar_lancamento
CREATE OR REPLACE FUNCTION public.solicitar_lancamento(
  p_socio_destino  uuid,
  p_tipo           text,
  p_valor          numeric,
  p_data_referencia date,
  p_descricao      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_criador      record;
  v_destino      record;
  v_empresa_id   uuid;
  v_solicit_id   uuid;
  v_socio        record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  IF p_tipo NOT IN ('credito','debito','pro_labore','ajuste') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tipo inválido');
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valor deve ser maior que zero');
  END IF;
  IF p_descricao IS NULL OR length(trim(p_descricao)) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Descrição/motivo é obrigatório (mínimo 3 caracteres)');
  END IF;

  SELECT * INTO v_criador FROM socios
   WHERE user_id = v_user_id AND ativo = true AND deleted_at IS NULL LIMIT 1;
  IF v_criador.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não é sócio ativo');
  END IF;
  v_empresa_id := v_criador.empresa_id;

  SELECT * INTO v_destino FROM socios
   WHERE id = p_socio_destino AND empresa_id = v_empresa_id AND ativo = true AND deleted_at IS NULL LIMIT 1;
  IF v_destino.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sócio destino inválido ou de outra empresa');
  END IF;

  INSERT INTO solicitacoes_lancamento (
    empresa_id, criada_por, criada_por_socio, socio_destino,
    tipo, valor, data_referencia, descricao
  ) VALUES (
    v_empresa_id, v_user_id, v_criador.id, p_socio_destino,
    p_tipo, p_valor, p_data_referencia, p_descricao
  )
  RETURNING id INTO v_solicit_id;

  INSERT INTO aprovacoes_lancamento (solicitacao_id, socio_id, user_id, voto, motivo)
  VALUES (v_solicit_id, v_criador.id, v_user_id, 'aprovado', 'Aprovado pelo criador (automático)');

  FOR v_socio IN
    SELECT id, user_id, nome FROM socios
     WHERE empresa_id = v_empresa_id
       AND ativo = true
       AND deleted_at IS NULL
       AND id <> v_criador.id
  LOOP
    INSERT INTO notificacoes_socio (empresa_id, socio_id, user_id, tipo, titulo, mensagem, ref_id, link_interno)
    VALUES (
      v_empresa_id, v_socio.id, v_socio.user_id,
      CASE WHEN v_socio.id = p_socio_destino
        THEN 'solicitacao_destino'
        ELSE 'solicitacao_aprovacao'
      END,
      CASE WHEN v_socio.id = p_socio_destino
        THEN 'Lançamento criado a seu favor'
        ELSE 'Aprovação pendente · ' || v_destino.nome
      END,
      v_criador.nome || ' criou um lançamento de '
        || CASE p_tipo WHEN 'credito' THEN 'crédito'
                       WHEN 'debito' THEN 'débito'
                       WHEN 'pro_labore' THEN 'pró-labore'
                       ELSE 'ajuste' END
        || ' de R$ ' || to_char(p_valor, 'FM999G999G990D00')
        || ' pra ' || v_destino.nome
        || ' · ' || trim(p_descricao),
      v_solicit_id,
      '/painel-socio/contas#solicitacao=' || v_solicit_id::text
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'solicitacao_id', v_solicit_id,
    'votos_atuais', 1,
    'votos_necessarios', 2,
    'status', 'aguardando_aprovacao'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.solicitar_lancamento(uuid, text, numeric, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.solicitar_lancamento(uuid, text, numeric, date, text) TO authenticated;

-- 3) RPC: votar_solicitacao
CREATE OR REPLACE FUNCTION public.votar_solicitacao(
  p_solicitacao_id uuid,
  p_voto           text,
  p_motivo         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_socio        record;
  v_solicit      record;
  v_qtd_aprov    int;
  v_extrato_id   uuid;
  v_valor_signed numeric;
  v_criador_socio record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  IF p_voto NOT IN ('aprovado','rejeitado') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voto inválido');
  END IF;
  IF p_voto = 'rejeitado' AND (p_motivo IS NULL OR length(trim(p_motivo)) < 3) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Motivo é obrigatório pra rejeitar (mínimo 3 caracteres)');
  END IF;

  SELECT * INTO v_socio FROM socios
   WHERE user_id = v_user_id AND ativo = true AND deleted_at IS NULL LIMIT 1;
  IF v_socio.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não é sócio ativo');
  END IF;

  SELECT * INTO v_solicit FROM solicitacoes_lancamento WHERE id = p_solicitacao_id;
  IF v_solicit.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada');
  END IF;
  IF v_solicit.empresa_id <> v_socio.empresa_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação de outra empresa');
  END IF;
  IF v_solicit.status <> 'aguardando_aprovacao' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Solicitação não está aguardando aprovação (status atual: ' || v_solicit.status || ')');
  END IF;

  IF EXISTS (SELECT 1 FROM aprovacoes_lancamento WHERE solicitacao_id = p_solicitacao_id AND socio_id = v_socio.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você já votou nesta solicitação');
  END IF;

  INSERT INTO aprovacoes_lancamento (solicitacao_id, socio_id, user_id, voto, motivo)
  VALUES (p_solicitacao_id, v_socio.id, v_user_id, p_voto, p_motivo);

  IF p_voto = 'rejeitado' THEN
    UPDATE solicitacoes_lancamento
       SET status = 'rejeitado',
           finalizada_em = now(),
           updated_at = now()
     WHERE id = p_solicitacao_id;

    SELECT * INTO v_criador_socio FROM socios WHERE id = v_solicit.criada_por_socio;
    INSERT INTO notificacoes_socio (empresa_id, socio_id, user_id, tipo, titulo, mensagem, ref_id, link_interno)
    VALUES (
      v_solicit.empresa_id, v_solicit.criada_por_socio, v_solicit.criada_por,
      'solicitacao_rejeitada',
      'Lançamento rejeitado',
      v_socio.nome || ' rejeitou sua solicitação. Motivo: ' || COALESCE(p_motivo, '—'),
      p_solicitacao_id,
      '/painel-socio/contas#solicitacao=' || p_solicitacao_id::text
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'rejeitado',
      'mensagem', 'Solicitação rejeitada'
    );
  END IF;

  SELECT COUNT(*) INTO v_qtd_aprov
    FROM aprovacoes_lancamento
   WHERE solicitacao_id = p_solicitacao_id AND voto = 'aprovado';

  IF v_qtd_aprov >= 2 THEN
    v_valor_signed := CASE WHEN v_solicit.tipo = 'debito'
                           THEN -v_solicit.valor
                           ELSE v_solicit.valor END;

    INSERT INTO extrato_socio (
      empresa_id, socio_id, tipo, valor, descricao, data_movimento, mes_ref, criado_por
    ) VALUES (
      v_solicit.empresa_id,
      v_solicit.socio_destino,
      CASE WHEN v_solicit.tipo = 'pro_labore' THEN 'pro_labore'
           ELSE 'ajuste' END,
      v_valor_signed,
      '[Retroativo] ' || v_solicit.descricao,
      v_solicit.data_referencia,
      to_char(v_solicit.data_referencia, 'YYYY-MM'),
      v_solicit.criada_por
    )
    RETURNING id INTO v_extrato_id;

    UPDATE solicitacoes_lancamento
       SET status = 'aprovado',
           extrato_id = v_extrato_id,
           finalizada_em = now(),
           updated_at = now()
     WHERE id = p_solicitacao_id;

    INSERT INTO notificacoes_socio (empresa_id, socio_id, user_id, tipo, titulo, mensagem, ref_id, link_interno)
    VALUES (
      v_solicit.empresa_id, v_solicit.criada_por_socio, v_solicit.criada_por,
      'solicitacao_aprovada',
      'Lançamento aprovado',
      'Sua solicitação de R$ ' || to_char(v_solicit.valor, 'FM999G999G990D00')
        || ' foi aprovada e registrada no extrato.',
      p_solicitacao_id,
      '/painel-socio/contas'
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'aprovado',
      'extrato_id', v_extrato_id,
      'mensagem', 'Solicitação aprovada e lançada no extrato'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'aguardando_aprovacao',
    'votos_atuais', v_qtd_aprov,
    'votos_necessarios', 2
  );
END;
$$;
REVOKE ALL ON FUNCTION public.votar_solicitacao(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.votar_solicitacao(uuid, text, text) TO authenticated;

-- 4) RPC: cancelar_solicitacao
CREATE OR REPLACE FUNCTION public.cancelar_solicitacao(p_solicitacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_solicit record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT * INTO v_solicit FROM solicitacoes_lancamento WHERE id = p_solicitacao_id;
  IF v_solicit.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada');
  END IF;
  IF v_solicit.criada_por <> v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Só quem criou pode cancelar');
  END IF;
  IF v_solicit.status <> 'aguardando_aprovacao' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Solicitação já foi finalizada (status: ' || v_solicit.status || ')');
  END IF;

  UPDATE solicitacoes_lancamento
     SET status = 'cancelado',
         finalizada_em = now(),
         updated_at = now()
   WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object('success', true, 'mensagem', 'Solicitação cancelada');
END;
$$;
REVOKE ALL ON FUNCTION public.cancelar_solicitacao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_solicitacao(uuid) TO authenticated;

-- 5) RPC: get_solicitacoes_pendentes
CREATE OR REPLACE FUNCTION public.get_solicitacoes_pendentes()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_socio   record;
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  SELECT * INTO v_socio FROM socios
   WHERE user_id = v_user_id AND ativo = true AND deleted_at IS NULL LIMIT 1;
  IF v_socio.id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'solicitacoes', '[]'::jsonb);
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'meu_socio_id', v_socio.id,
    'solicitacoes', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',                 s.id,
        'tipo',               s.tipo,
        'valor',              s.valor,
        'data_referencia',    s.data_referencia,
        'descricao',          s.descricao,
        'created_at',         s.created_at,
        'criada_por_socio_id', s.criada_por_socio,
        'criada_por_nome',    (SELECT nome FROM socios WHERE id = s.criada_por_socio),
        'socio_destino_id',   s.socio_destino,
        'socio_destino_nome', (SELECT nome FROM socios WHERE id = s.socio_destino),
        'eu_criei',           (s.criada_por = v_user_id),
        'eu_ja_votei',        EXISTS (
          SELECT 1 FROM aprovacoes_lancamento
           WHERE solicitacao_id = s.id AND socio_id = v_socio.id
        ),
        'votos', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'socio_id',  a.socio_id,
              'socio_nome',(SELECT nome FROM socios WHERE id = a.socio_id),
              'voto',      a.voto,
              'motivo',    a.motivo,
              'votado_em', a.votado_em
            ) ORDER BY a.votado_em
          ), '[]'::jsonb)
          FROM aprovacoes_lancamento a
          WHERE a.solicitacao_id = s.id
        )
      ) ORDER BY s.created_at DESC
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM solicitacoes_lancamento s
  WHERE s.empresa_id = v_socio.empresa_id
    AND s.status = 'aguardando_aprovacao';

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_solicitacoes_pendentes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_solicitacoes_pendentes() TO authenticated;

-- 6) RPC: get_notificacoes
CREATE OR REPLACE FUNCTION public.get_notificacoes(p_apenas_nao_lidas boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_lista jsonb;
  v_nao_lidas int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;
  SELECT COUNT(*) INTO v_nao_lidas
    FROM notificacoes_socio
   WHERE user_id = v_user_id AND lida = false;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'tipo', tipo,
      'titulo', titulo,
      'mensagem', mensagem,
      'link_interno', link_interno,
      'ref_id', ref_id,
      'lida', lida,
      'created_at', created_at
    ) ORDER BY created_at DESC
  ), '[]'::jsonb)
  INTO v_lista
  FROM (
    SELECT * FROM notificacoes_socio
    WHERE user_id = v_user_id
      AND (p_apenas_nao_lidas = false OR lida = false)
    ORDER BY created_at DESC
    LIMIT 50
  ) sub;

  RETURN jsonb_build_object('success', true, 'nao_lidas', v_nao_lidas, 'notificacoes', v_lista);
END;
$$;
REVOKE ALL ON FUNCTION public.get_notificacoes(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_notificacoes(boolean) TO authenticated;

-- 7) RPC: marcar_notificacao_lida
CREATE OR REPLACE FUNCTION public.marcar_notificacao_lida(p_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  IF p_id IS NULL THEN
    UPDATE notificacoes_socio SET lida = true, lida_em = now()
     WHERE user_id = v_user_id AND lida = false;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    UPDATE notificacoes_socio SET lida = true, lida_em = now()
     WHERE id = p_id AND user_id = v_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('success', true, 'marcadas', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.marcar_notificacao_lida(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_notificacao_lida(uuid) TO authenticated;

-- 8) RLS
ALTER TABLE public.solicitacoes_lancamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aprovacoes_lancamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes_socio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "socio_ve_solicit_propria_empresa" ON public.solicitacoes_lancamento;
CREATE POLICY "socio_ve_solicit_propria_empresa" ON public.solicitacoes_lancamento
  FOR SELECT TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM socios WHERE user_id = auth.uid() AND ativo = true AND deleted_at IS NULL));

DROP POLICY IF EXISTS "socio_ve_aprovacoes_propria_empresa" ON public.aprovacoes_lancamento;
CREATE POLICY "socio_ve_aprovacoes_propria_empresa" ON public.aprovacoes_lancamento
  FOR SELECT TO authenticated
  USING (solicitacao_id IN (
    SELECT id FROM solicitacoes_lancamento
    WHERE empresa_id IN (SELECT empresa_id FROM socios WHERE user_id = auth.uid() AND ativo = true AND deleted_at IS NULL)
  ));

DROP POLICY IF EXISTS "socio_ve_propria_notificacao" ON public.notificacoes_socio;
CREATE POLICY "socio_ve_propria_notificacao" ON public.notificacoes_socio
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());