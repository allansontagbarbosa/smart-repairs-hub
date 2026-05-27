
-- ============================================================
-- 1) avaliacoes: anon INSERT must validate empresa_id matches OS
-- ============================================================
DROP POLICY IF EXISTS avaliacoes_insert_anon_com_os_valida ON public.avaliacoes;

CREATE POLICY avaliacoes_insert_anon_com_os_valida
ON public.avaliacoes
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1
      FROM public.ordens_de_servico o
     WHERE o.id = avaliacoes.ordem_id
       AND o.deleted_at IS NULL
       AND (o.status)::text = 'entregue'
       AND o.empresa_id = avaliacoes.empresa_id
  )
  AND avaliacoes.empresa_id IS NOT NULL
);

-- ============================================================
-- 2) realtime.messages: scope broadcast/presence by empresa_id topic
--    Keep postgres_changes path working (table-level RLS already
--    filters rows by empresa_id on notificacoes).
-- ============================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT polname
      FROM pg_policy
     WHERE polrelid = 'realtime.messages'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON realtime.messages', r.polname);
  END LOOP;
END $$;

-- Allow authenticated users to receive realtime messages only when:
--   - the message is from postgres_changes (row-level RLS on source table applies), OR
--   - the topic is scoped to their empresa (topic starts with "<empresa_id>:")
CREATE POLICY realtime_messages_tenant_scoped_select
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'postgres_changes'
  OR topic LIKE (public.get_my_empresa_id()::text || ':%')
);

-- Restrict broadcast sends to topics scoped to the user's empresa
CREATE POLICY realtime_messages_tenant_scoped_insert
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  topic LIKE (public.get_my_empresa_id()::text || ':%')
);
