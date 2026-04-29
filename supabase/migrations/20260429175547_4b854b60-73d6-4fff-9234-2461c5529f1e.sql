-- Fase 1 / Parte 1: consolidar baixa imediata de estoque para pecas_utilizadas

-- Parte A: remover triggers redundantes em pecas_utilizadas, mantendo as functions existentes
DROP TRIGGER IF EXISTS trg_pecas_utilizadas_baixa ON public.pecas_utilizadas;
DROP TRIGGER IF EXISTS trg_pecas_utilizadas_baixa_estoque_recalcular_ins ON public.pecas_utilizadas;
DROP TRIGGER IF EXISTS trg_pecas_utilizadas_devolver ON public.pecas_utilizadas;
DROP TRIGGER IF EXISTS trg_pecas_utilizadas_devolver_estoque_recalcular_del ON public.pecas_utilizadas;

-- Parte B: garantir que trg_baixa_estoque_os faça apenas a baixa imediata no INSERT de pecas_utilizadas.
-- Inspeção prévia: o ramo TG_TABLE_NAME = 'pecas_utilizadas' já gravava estoque_movimentos e também fazia UPDATE em estoque_itens.quantidade.
-- A function foi reduzida para remover a lógica antiga de baixa/devolução por mudança de status da OS.
CREATE OR REPLACE FUNCTION public.trg_baixa_estoque_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'pecas_utilizadas' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.estoque_movimentos
      WHERE pecas_utilizadas_id = NEW.id
        AND tipo = 'saida_os'
    ) THEN
      INSERT INTO public.estoque_movimentos (
        empresa_id,
        peca_id,
        os_id,
        pecas_utilizadas_id,
        tipo,
        quantidade,
        motivo
      ) VALUES (
        NEW.empresa_id,
        NEW.peca_id,
        NEW.ordem_id,
        NEW.id,
        'saida_os',
        NEW.quantidade,
        'Baixa automatica por uso em OS'
      );

      UPDATE public.estoque_itens
      SET quantidade = quantidade - NEW.quantidade::int,
          updated_at = now()
      WHERE id = NEW.peca_id;
    END IF;

    PERFORM public.recalcular_totais_os(NEW.ordem_id);
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public'
      AND c.relname = 'pecas_utilizadas'
      AND t.tgname = 'trg_baixa_estoque_os_pecas_insert'
      AND NOT t.tgisinternal
      AND p.proname = 'trg_baixa_estoque_os'
  ) THEN
    CREATE TRIGGER trg_baixa_estoque_os_pecas_insert
    AFTER INSERT ON public.pecas_utilizadas
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_baixa_estoque_os();
  END IF;
END $$;

-- Parte C: cancelar_os passa a devolver estoque de todas as peças baixadas, com critério idempotente.
CREATE OR REPLACE FUNCTION public.cancelar_os(p_ordem_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT := public.get_my_role();
  v_empresa_id UUID := public.get_my_empresa_id();
  v_user_nome TEXT;
  v_os RECORD;
  v_peca RECORD;
  v_pecas_estornadas JSONB := '[]'::jsonb;
  v_comissoes_estornadas JSONB := '[]'::jsonb;
  v_total_pecas NUMERIC := 0;
  v_total_comissao NUMERIC := 0;
  v_qtd_pecas INT := 0;
  v_qtd_comissoes INT := 0;
BEGIN
  IF v_role NOT IN ('admin', 'Administrador') THEN
    RAISE EXCEPTION 'Apenas administradores podem cancelar ordens de serviço'
      USING ERRCODE = '42501';
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'O motivo do cancelamento deve ter pelo menos 10 caracteres'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_os
    FROM public.ordens_de_servico
    WHERE id = p_ordem_id AND empresa_id = v_empresa_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_os.status::text = 'cancelado' THEN
    RAISE EXCEPTION 'OS já está cancelada.' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(nome_exibicao, 'Usuário')
    INTO v_user_nome
    FROM public.user_profiles
    WHERE user_id = v_user_id OR id = v_user_id
    LIMIT 1;

  IF v_user_nome IS NULL THEN
    v_user_nome := 'Usuário';
  END IF;

  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'peca_id', peca_id,
      'quantidade', quantidade,
      'preco_unitario', preco_unitario,
      'valor', COALESCE(preco_unitario * quantidade, 0)
    )), '[]'::jsonb),
    COALESCE(SUM(preco_unitario * quantidade), 0),
    COUNT(*)
  INTO v_pecas_estornadas, v_total_pecas, v_qtd_pecas
  FROM public.pecas_utilizadas
  WHERE ordem_id = p_ordem_id;

  FOR v_peca IN
    SELECT id, empresa_id, peca_id, ordem_id, quantidade
    FROM public.pecas_utilizadas
    WHERE ordem_id = p_ordem_id
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.estoque_movimentos
      WHERE pecas_utilizadas_id = v_peca.id
        AND tipo = 'saida_os'
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.estoque_movimentos
      WHERE pecas_utilizadas_id = v_peca.id
        AND tipo = 'entrada_os'
    ) THEN
      INSERT INTO public.estoque_movimentos (
        empresa_id,
        peca_id,
        os_id,
        pecas_utilizadas_id,
        tipo,
        quantidade,
        motivo
      ) VALUES (
        v_peca.empresa_id,
        v_peca.peca_id,
        v_peca.ordem_id,
        v_peca.id,
        'entrada_os',
        v_peca.quantidade,
        'Cancelamento de OS, devolucao automatica'
      );

      UPDATE public.estoque_itens
      SET quantidade = quantidade + v_peca.quantidade::int,
          updated_at = now()
      WHERE id = v_peca.peca_id;
    END IF;
  END LOOP;

  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'funcionario_id', funcionario_id,
      'valor', valor,
      'status_anterior', status::text
    )), '[]'::jsonb),
    COALESCE(SUM(valor), 0),
    COUNT(*)
  INTO v_comissoes_estornadas, v_total_comissao, v_qtd_comissoes
  FROM public.comissoes
  WHERE ordem_id = p_ordem_id AND status::text <> 'estornada';

  IF v_qtd_comissoes > 0 THEN
    UPDATE public.comissoes
       SET status = 'estornada',
           estornada_em = now(),
           estornada_por = v_user_id
     WHERE ordem_id = p_ordem_id
       AND status::text <> 'estornada';
  END IF;

  UPDATE public.ordens_de_servico
     SET status = 'cancelado',
         cancelada_em = now(),
         cancelada_por = v_user_id,
         motivo_cancelamento = p_motivo,
         impacto_cancelamento = jsonb_build_object(
           'status_anterior', v_os.status::text,
           'pecas_estornadas', v_pecas_estornadas,
           'comissoes_estornadas', v_comissoes_estornadas,
           'total_pecas', v_total_pecas,
           'total_comissao', v_total_comissao,
           'qtd_pecas', v_qtd_pecas,
           'qtd_comissoes', v_qtd_comissoes
         )
   WHERE id = p_ordem_id;

  INSERT INTO public.os_auditoria (
    empresa_id, ordem_id, acao,
    realizada_por, realizada_por_nome, realizada_por_role,
    motivo, payload
  ) VALUES (
    v_empresa_id, p_ordem_id, 'cancelamento',
    v_user_id, v_user_nome, v_role,
    p_motivo,
    jsonb_build_object(
      'status_anterior', v_os.status::text,
      'pecas_estornadas', v_pecas_estornadas,
      'comissoes_estornadas', v_comissoes_estornadas,
      'total_pecas_estornadas', v_total_pecas,
      'total_comissao_estornada', v_total_comissao
    )
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'numero', v_os.numero,
    'numero_formatado', v_os.numero_formatado,
    'pecas_estornadas', v_total_pecas,
    'comissoes_estornadas', v_total_comissao,
    'qtd_pecas', v_qtd_pecas,
    'qtd_comissoes', v_qtd_comissoes
  );
END;
$function$;

-- Parte D: bloquear estoque negativo, corrigindo eventual dado legado antes da constraint.
UPDATE public.estoque_itens
SET quantidade = 0,
    updated_at = now()
WHERE quantidade < 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.estoque_itens'::regclass
      AND conname = 'chk_estoque_itens_quantidade_nao_negativa'
  ) THEN
    ALTER TABLE public.estoque_itens
    ADD CONSTRAINT chk_estoque_itens_quantidade_nao_negativa
    CHECK (quantidade >= 0);
  END IF;
END $$;