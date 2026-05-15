
BEGIN;

ALTER TABLE public.ordens_de_servico
  ADD COLUMN IF NOT EXISTS tecnico_responsavel_id UUID NULL
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_os_tecnico_responsavel
  ON public.ordens_de_servico(tecnico_responsavel_id)
  WHERE tecnico_responsavel_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.os_status_historico (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id           UUID NOT NULL REFERENCES public.ordens_de_servico(id) ON DELETE CASCADE,
  empresa_id      UUID NOT NULL,
  status_anterior TEXT NULL,
  status_novo     TEXT NOT NULL,
  mudado_por      UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  mudado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacao      TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_os_status_hist_os_id
  ON public.os_status_historico(os_id, mudado_em DESC);
CREATE INDEX IF NOT EXISTS idx_os_status_hist_empresa
  ON public.os_status_historico(empresa_id);

ALTER TABLE public.os_status_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "os_status_historico_select" ON public.os_status_historico;
CREATE POLICY "os_status_historico_select"
  ON public.os_status_historico
  FOR SELECT
  USING (empresa_id = public.get_my_empresa_id());

DROP POLICY IF EXISTS "os_status_historico_insert" ON public.os_status_historico;
CREATE POLICY "os_status_historico_insert"
  ON public.os_status_historico
  FOR INSERT
  WITH CHECK (empresa_id = public.get_my_empresa_id());

CREATE OR REPLACE FUNCTION public.os_status_mapear_legado(p_status TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE LOWER(COALESCE(p_status, ''))
    WHEN 'aberta'        THEN 'recebido'
    WHEN 'em_andamento'  THEN 'em_reparo'
    WHEN 'em andamento'  THEN 'em_reparo'
    WHEN 'concluida'     THEN 'entregue'
    WHEN 'concluída'     THEN 'entregue'
    WHEN 'paga'          THEN 'paga'
    WHEN 'recebido'         THEN 'recebido'
    WHEN 'em_analise'       THEN 'em_analise'
    WHEN 'aprovacao'        THEN 'aprovacao'
    WHEN 'em_reparo'        THEN 'em_reparo'
    WHEN 'aguardando_peca'  THEN 'aguardando_peca'
    WHEN 'pronto'           THEN 'pronto'
    WHEN 'entregue'         THEN 'entregue'
    ELSE COALESCE(p_status, 'recebido')
  END;
$$;

CREATE OR REPLACE FUNCTION public.os_status_reconhece_receita(p_status TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT public.os_status_mapear_legado(p_status) IN ('pronto', 'entregue', 'paga');
$$;

CREATE OR REPLACE FUNCTION public.os_status_em_casa(p_status TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT public.os_status_mapear_legado(p_status) IN (
    'recebido', 'em_analise', 'aprovacao', 'em_reparo', 'aguardando_peca'
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_log_os_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status_anterior TEXT;
  v_status_novo TEXT;
  v_user UUID;
BEGIN
  v_user := auth.uid();
  IF TG_OP = 'INSERT' THEN
    v_status_novo := public.os_status_mapear_legado(NEW.status::text);
    INSERT INTO public.os_status_historico
      (os_id, empresa_id, status_anterior, status_novo, mudado_por, observacao)
    VALUES
      (NEW.id, NEW.empresa_id, NULL, v_status_novo, v_user, 'OS criada');
  ELSIF TG_OP = 'UPDATE' THEN
    v_status_anterior := public.os_status_mapear_legado(OLD.status::text);
    v_status_novo := public.os_status_mapear_legado(NEW.status::text);
    IF v_status_anterior IS DISTINCT FROM v_status_novo THEN
      INSERT INTO public.os_status_historico
        (os_id, empresa_id, status_anterior, status_novo, mudado_por)
      VALUES
        (NEW.id, NEW.empresa_id, v_status_anterior, v_status_novo, v_user);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_os_status_change ON public.ordens_de_servico;
CREATE TRIGGER trg_log_os_status_change
  AFTER INSERT OR UPDATE OF status ON public.ordens_de_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_os_status_change();

INSERT INTO public.os_status_historico
  (os_id, empresa_id, status_anterior, status_novo, mudado_por, mudado_em, observacao)
SELECT
  os.id,
  os.empresa_id,
  NULL,
  public.os_status_mapear_legado(os.status::text),
  NULL,
  COALESCE(os.created_at, now()),
  'Backfill — status inicial registrado retroativamente'
FROM public.ordens_de_servico os
WHERE NOT EXISTS (
  SELECT 1 FROM public.os_status_historico h WHERE h.os_id = os.id
)
  AND os.deleted_at IS NULL;

COMMIT;
