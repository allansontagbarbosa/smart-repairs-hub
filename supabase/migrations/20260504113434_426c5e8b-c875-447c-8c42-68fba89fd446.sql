-- Migration: chat_ia_fundacao
-- Cria infraestrutura base para o assistente IA do Ditt:
-- conversas, mensagens, log de auditoria, controle de uso de tokens.

-- ─────────────────────────────────────────────────────────────────────
-- TABELAS
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ia_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  usuario_id uuid NOT NULL REFERENCES auth.users(id),
  titulo text,
  contexto_origem jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS ix_ia_conversas_empresa ON public.ia_conversas(empresa_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_ia_conversas_usuario ON public.ia_conversas(usuario_id, atualizado_em DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.ia_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.ia_conversas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  papel text NOT NULL CHECK (papel IN ('user', 'assistant', 'tool_use', 'tool_result', 'system')),
  conteudo text,
  tool_name text,
  tool_input jsonb,
  tool_result jsonb,
  tokens_input int,
  tokens_output int,
  modelo text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ia_mensagens_conversa ON public.ia_mensagens(conversa_id, criado_em);
CREATE INDEX IF NOT EXISTS ix_ia_mensagens_empresa ON public.ia_mensagens(empresa_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS public.ia_acoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  usuario_id uuid NOT NULL REFERENCES auth.users(id),
  conversa_id uuid REFERENCES public.ia_conversas(id),
  tool_chamada text NOT NULL,
  argumentos jsonb,
  resultado jsonb,
  ids_afetados uuid[],
  snapshot_antes jsonb,
  aprovado_por uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'executada' CHECK (status IN ('proposta', 'aprovada', 'executada', 'rejeitada', 'erro')),
  erro_mensagem text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ia_acoes_empresa ON public.ia_acoes_log(empresa_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS public.ia_uso_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  mes_competencia text NOT NULL,
  tokens_input bigint NOT NULL DEFAULT 0,
  tokens_output bigint NOT NULL DEFAULT 0,
  custo_brl numeric(10,4) NOT NULL DEFAULT 0,
  teto_brl numeric(10,2) NOT NULL DEFAULT 50.00,
  bloqueado boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, mes_competencia)
);

CREATE INDEX IF NOT EXISTS ix_ia_uso_empresa ON public.ia_uso_tokens(empresa_id, mes_competencia);

-- ─────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.ia_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_acoes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_uso_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY ia_conversas_select ON public.ia_conversas FOR SELECT
  USING (empresa_id = public.get_my_empresa_id() AND deleted_at IS NULL);

CREATE POLICY ia_conversas_insert ON public.ia_conversas FOR INSERT
  WITH CHECK (empresa_id = public.get_my_empresa_id() AND usuario_id = auth.uid());

CREATE POLICY ia_conversas_update ON public.ia_conversas FOR UPDATE
  USING (empresa_id = public.get_my_empresa_id() AND usuario_id = auth.uid());

CREATE POLICY ia_mensagens_select ON public.ia_mensagens FOR SELECT
  USING (empresa_id = public.get_my_empresa_id());

CREATE POLICY ia_mensagens_insert ON public.ia_mensagens FOR INSERT
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE POLICY ia_acoes_select ON public.ia_acoes_log FOR SELECT
  USING (empresa_id = public.get_my_empresa_id());

CREATE POLICY ia_uso_select ON public.ia_uso_tokens FOR SELECT
  USING (empresa_id = public.get_my_empresa_id());

-- ─────────────────────────────────────────────────────────────────────
-- RPC: criar conversa
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ia_criar_conversa(
  p_titulo text DEFAULT NULL,
  p_contexto jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_user uuid;
  v_id uuid;
BEGIN
  v_empresa := public.get_my_empresa_id();
  v_user := auth.uid();

  IF v_empresa IS NULL OR v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  INSERT INTO public.ia_conversas (empresa_id, usuario_id, titulo, contexto_origem)
  VALUES (v_empresa, v_user, p_titulo, p_contexto)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'conversa_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ia_criar_conversa(text, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- RPC: registrar uso (chamada via service_role pela Edge Function)
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ia_registrar_uso(
  p_empresa_id uuid,
  p_tokens_input int,
  p_tokens_output int,
  p_modelo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes text := to_char(now(), 'YYYY-MM');
  v_custo numeric(10,4);
  v_teto numeric(10,2);
  v_total_apos numeric(10,4);
  v_bloqueado boolean;
BEGIN
  v_custo := CASE
    WHEN p_modelo LIKE '%haiku%' THEN
      (p_tokens_input::numeric / 1000000) * 5.50 +
      (p_tokens_output::numeric / 1000000) * 27.50
    WHEN p_modelo LIKE '%sonnet%' THEN
      (p_tokens_input::numeric / 1000000) * 16.50 +
      (p_tokens_output::numeric / 1000000) * 82.50
    ELSE
      (p_tokens_input::numeric / 1000000) * 16.50 +
      (p_tokens_output::numeric / 1000000) * 82.50
  END;

  INSERT INTO public.ia_uso_tokens (empresa_id, mes_competencia, tokens_input, tokens_output, custo_brl)
  VALUES (p_empresa_id, v_mes, p_tokens_input, p_tokens_output, v_custo)
  ON CONFLICT (empresa_id, mes_competencia) DO UPDATE SET
    tokens_input  = public.ia_uso_tokens.tokens_input  + EXCLUDED.tokens_input,
    tokens_output = public.ia_uso_tokens.tokens_output + EXCLUDED.tokens_output,
    custo_brl     = public.ia_uso_tokens.custo_brl     + EXCLUDED.custo_brl,
    atualizado_em = now();

  SELECT custo_brl, teto_brl INTO v_total_apos, v_teto
    FROM public.ia_uso_tokens
   WHERE empresa_id = p_empresa_id AND mes_competencia = v_mes;

  v_bloqueado := v_total_apos >= v_teto;

  IF v_bloqueado THEN
    UPDATE public.ia_uso_tokens
       SET bloqueado = true
     WHERE empresa_id = p_empresa_id AND mes_competencia = v_mes;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'custo_brl', v_total_apos,
    'teto_brl', v_teto,
    'bloqueado', v_bloqueado
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- RPC: pode usar?
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ia_pode_usar()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_user uuid;
  v_mes text := to_char(now(), 'YYYY-MM');
  v_bloqueado boolean;
  v_custo numeric(10,4);
  v_teto numeric(10,2);
  v_msgs_hoje int;
BEGIN
  v_empresa := public.get_my_empresa_id();
  v_user := auth.uid();

  IF v_empresa IS NULL THEN
    RETURN jsonb_build_object('pode', false, 'motivo', 'sem_empresa');
  END IF;

  SELECT bloqueado, custo_brl, teto_brl
    INTO v_bloqueado, v_custo, v_teto
    FROM public.ia_uso_tokens
   WHERE empresa_id = v_empresa AND mes_competencia = v_mes;

  IF v_bloqueado THEN
    RETURN jsonb_build_object(
      'pode', false,
      'motivo', 'teto_atingido',
      'custo_brl', v_custo,
      'teto_brl', v_teto
    );
  END IF;

  SELECT COUNT(*) INTO v_msgs_hoje
    FROM public.ia_mensagens m
    JOIN public.ia_conversas c ON c.id = m.conversa_id
   WHERE c.usuario_id = v_user
     AND m.papel = 'user'
     AND m.criado_em >= date_trunc('day', now());

  IF v_msgs_hoje >= 50 THEN
    RETURN jsonb_build_object('pode', false, 'motivo', 'rate_limit_diario', 'msgs_hoje', v_msgs_hoje);
  END IF;

  RETURN jsonb_build_object(
    'pode', true,
    'custo_brl', COALESCE(v_custo, 0),
    'teto_brl', COALESCE(v_teto, 50),
    'msgs_hoje', v_msgs_hoje
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ia_pode_usar() TO authenticated;