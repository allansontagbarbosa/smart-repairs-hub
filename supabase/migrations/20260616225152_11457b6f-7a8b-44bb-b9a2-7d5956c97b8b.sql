DROP POLICY IF EXISTS "realtime_messages_tenant_scoped_select" ON realtime.messages;

CREATE POLICY "realtime_messages_tenant_scoped_select"
ON realtime.messages
FOR SELECT
TO authenticated
USING (topic LIKE (get_my_empresa_id()::text || ':%'));