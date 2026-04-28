BEGIN;

DO $$ BEGIN
  CREATE TYPE public.status_servico AS ENUM ('pendente', 'em_reparo', 'concluido', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.os_servicos
  ADD COLUMN IF NOT EXISTS tecnico_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status public.status_servico NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS iniciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_os_servicos_tecnico_id ON public.os_servicos(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_os_servicos_status ON public.os_servicos(status);
CREATE INDEX IF NOT EXISTS idx_os_servicos_ordem_id ON public.os_servicos(ordem_id);

UPDATE public.os_servicos os
SET tecnico_id = ord.funcionario_id
FROM public.ordens_de_servico ord
WHERE os.ordem_id = ord.id
  AND os.tecnico_id IS NULL
  AND ord.funcionario_id IS NOT NULL;

UPDATE public.os_servicos os
SET status = CASE
  WHEN ord.status::text IN ('entregue', 'pronto') THEN 'concluido'::public.status_servico
  WHEN ord.status::text IN ('em_reparo', 'aguardando_pecas') THEN 'em_reparo'::public.status_servico
  WHEN ord.status::text = 'cancelado' THEN 'cancelado'::public.status_servico
  ELSE 'pendente'::public.status_servico
END,
concluido_em = CASE 
  WHEN ord.status::text IN ('entregue', 'pronto') THEN COALESCE(ord.data_conclusao, ord.updated_at, now())
  ELSE NULL
END,
iniciado_em = CASE
  WHEN ord.status::text IN ('em_reparo', 'aguardando_pecas', 'pronto', 'entregue') 
    THEN COALESCE(ord.data_entrada, ord.created_at)
  ELSE NULL
END
FROM public.ordens_de_servico ord
WHERE os.ordem_id = ord.id;

CREATE OR REPLACE FUNCTION public.gerar_comissao_por_servico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_valor numeric := 0;
  v_comissao_padrao numeric := 0;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status::text = 'concluido'
     AND (
       NEW.status::text IS DISTINCT FROM 'concluido'
       OR NEW.tecnico_id IS DISTINCT FROM OLD.tecnico_id
     ) THEN
    UPDATE public.comissoes
    SET status = 'estornada', estornada_em = now()
    WHERE os_servico_id = NEW.id
      AND estornada_em IS NULL;
  END IF;

  IF NEW.status::text = 'concluido' AND NEW.tecnico_id IS NOT NULL THEN
    IF COALESCE(NEW.comissao, 0) > 0 THEN
      v_valor := NEW.comissao;
    ELSE
      SELECT COALESCE(ts.comissao_padrao, 0)
      INTO v_comissao_padrao
      FROM public.tipos_servico ts
      WHERE ts.id = NEW.servico_id;

      IF COALESCE(v_comissao_padrao, 0) > 0 THEN
        v_valor := v_comissao_padrao;
      ELSE
        v_valor := 0;
      END IF;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.comissoes c
      WHERE c.os_servico_id = NEW.id
        AND c.estornada_em IS NULL
    ) THEN
      INSERT INTO public.comissoes (
        funcionario_id,
        ordem_id,
        os_servico_id,
        valor,
        valor_base,
        status,
        tipo,
        mes_competencia,
        empresa_id,
        observacoes
      ) VALUES (
        NEW.tecnico_id,
        NEW.ordem_id,
        NEW.id,
        v_valor,
        v_valor,
        'pendente',
        'fixa',
        to_char(COALESCE(NEW.concluido_em, now()), 'YYYY-MM'),
        NEW.empresa_id,
        'Serviço: ' || COALESCE(NEW.nome, NEW.id::text)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gerar_comissao_por_servico ON public.os_servicos;

CREATE TRIGGER trg_gerar_comissao_por_servico
  AFTER INSERT OR UPDATE OF status, tecnico_id, comissao
  ON public.os_servicos
  FOR EACH ROW
  EXECUTE FUNCTION public.gerar_comissao_por_servico();

CREATE OR REPLACE FUNCTION public.agregar_status_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ordem_id uuid;
  v_status_os text;
  v_total int;
  v_concluidos int;
  v_em_reparo int;
  v_pendentes int;
BEGIN
  v_ordem_id := COALESCE(NEW.ordem_id, OLD.ordem_id);

  SELECT status::text
  INTO v_status_os
  FROM public.ordens_de_servico
  WHERE id = v_ordem_id;

  IF v_status_os IS NULL OR v_status_os IN ('entregue', 'cancelado') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status::text = 'concluido'),
    COUNT(*) FILTER (WHERE status::text = 'em_reparo'),
    COUNT(*) FILTER (WHERE status::text = 'pendente')
  INTO v_total, v_concluidos, v_em_reparo, v_pendentes
  FROM public.os_servicos
  WHERE ordem_id = v_ordem_id;

  IF v_total = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_total = v_concluidos THEN
    UPDATE public.ordens_de_servico
    SET status = 'pronto'
    WHERE id = v_ordem_id
      AND status::text NOT IN ('pronto', 'entregue', 'cancelado');
  ELSIF v_em_reparo > 0 THEN
    UPDATE public.ordens_de_servico
    SET status = 'em_reparo'
    WHERE id = v_ordem_id
      AND status::text NOT IN ('pronto', 'entregue', 'cancelado');
  ELSIF v_total = v_pendentes THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_agregar_status_os ON public.os_servicos;

CREATE TRIGGER trg_agregar_status_os
  AFTER INSERT OR UPDATE OF status OR DELETE
  ON public.os_servicos
  FOR EACH ROW
  EXECUTE FUNCTION public.agregar_status_os();

CREATE OR REPLACE FUNCTION public.iniciar_servico_os(p_os_servico_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_funcionario_id uuid;
  v_servico_atual record;
  v_empresa_id uuid;
BEGIN
  SELECT f.id, f.empresa_id INTO v_funcionario_id, v_empresa_id
  FROM public.funcionarios f
  JOIN public.user_profiles up ON up.funcionario_id = f.id
  WHERE up.user_id = auth.uid()
    AND f.deleted_at IS NULL
  LIMIT 1;

  IF v_funcionario_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não vinculado a um funcionário');
  END IF;

  SELECT * INTO v_servico_atual
  FROM public.os_servicos
  WHERE id = p_os_servico_id
    AND empresa_id = v_empresa_id;

  IF v_servico_atual IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Serviço não encontrado');
  END IF;

  IF v_servico_atual.status::text != 'pendente' THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Serviço já foi iniciado por outro técnico ou já está concluído',
      'tecnico_atual', v_servico_atual.tecnico_id,
      'status_atual', v_servico_atual.status::text
    );
  END IF;

  UPDATE public.os_servicos
  SET tecnico_id = v_funcionario_id,
      status = 'em_reparo'::public.status_servico,
      iniciado_em = now()
  WHERE id = p_os_servico_id
    AND status::text = 'pendente';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Serviço foi pego por outro técnico simultaneamente');
  END IF;

  RETURN json_build_object('success', true, 'tecnico_id', v_funcionario_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.iniciar_servico_os(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.concluir_servico_os(p_os_servico_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_funcionario_id uuid;
  v_servico record;
BEGIN
  SELECT f.id INTO v_funcionario_id
  FROM public.funcionarios f
  JOIN public.user_profiles up ON up.funcionario_id = f.id
  WHERE up.user_id = auth.uid() AND f.deleted_at IS NULL
  LIMIT 1;

  IF v_funcionario_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não vinculado');
  END IF;

  SELECT * INTO v_servico FROM public.os_servicos WHERE id = p_os_servico_id;

  IF v_servico IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Serviço não encontrado');
  END IF;

  IF v_servico.tecnico_id != v_funcionario_id THEN
    RETURN json_build_object('success', false, 'error', 'Apenas o técnico atribuído pode concluir');
  END IF;

  IF v_servico.status::text != 'em_reparo' THEN
    RETURN json_build_object('success', false, 'error', 'Serviço não está em reparo');
  END IF;

  UPDATE public.os_servicos
  SET status = 'concluido'::public.status_servico,
      concluido_em = now()
  WHERE id = p_os_servico_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.concluir_servico_os(uuid) TO authenticated;

UPDATE public.os_servicos 
SET status = status 
WHERE status = 'concluido' AND tecnico_id IS NOT NULL;

DO $$
DECLARE
  v_servicos_com_tecnico int;
  v_servicos_concluidos int;
  v_comissoes_total int;
  v_comissoes_zeradas int;
  v_comissoes_com_valor int;
  v_trigger_existe boolean;
BEGIN
  SELECT COUNT(*) INTO v_servicos_com_tecnico FROM public.os_servicos WHERE tecnico_id IS NOT NULL;
  SELECT COUNT(*) INTO v_servicos_concluidos FROM public.os_servicos WHERE status = 'concluido';
  SELECT COUNT(*) INTO v_comissoes_total FROM public.comissoes WHERE estornada_em IS NULL;
  SELECT COUNT(*) INTO v_comissoes_zeradas FROM public.comissoes WHERE estornada_em IS NULL AND valor = 0;
  SELECT COUNT(*) INTO v_comissoes_com_valor FROM public.comissoes WHERE estornada_em IS NULL AND valor > 0;
  
  SELECT EXISTS(
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_schema='public' AND trigger_name='trg_gerar_comissao_por_servico'
  ) INTO v_trigger_existe;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'MIGRATION ETAPA 1 — RESULTADO';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Serviços com técnico atribuído: %', v_servicos_com_tecnico;
  RAISE NOTICE 'Serviços com status concluido: %', v_servicos_concluidos;
  RAISE NOTICE 'Comissões geradas (não estornadas): %', v_comissoes_total;
  RAISE NOTICE '  → com valor > 0: %', v_comissoes_com_valor;
  RAISE NOTICE '  → com valor = 0 (catálogo sem comissão_padrao): %', v_comissoes_zeradas;
  RAISE NOTICE 'Trigger trg_gerar_comissao_por_servico ativo: %', v_trigger_existe;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  
  IF NOT v_trigger_existe THEN
    RAISE EXCEPTION 'TRIGGER NÃO FOI CRIADO — abortar';
  END IF;
END $$;

COMMIT;