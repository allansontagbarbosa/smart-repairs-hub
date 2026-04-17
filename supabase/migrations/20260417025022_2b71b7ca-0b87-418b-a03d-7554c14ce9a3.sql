-- Permitir que o usuário autenticado encontre/atualize seu próprio vínculo lojista
-- pelo email, quando o user_id ainda não foi vinculado (placeholder ou pendente)

CREATE POLICY "lojista_select_por_email" ON public.lojista_usuarios
FOR SELECT TO authenticated
USING (lower(email) = lower((auth.jwt() ->> 'email')));

CREATE POLICY "lojista_backfill_user_id" ON public.lojista_usuarios
FOR UPDATE TO authenticated
USING (lower(email) = lower((auth.jwt() ->> 'email')))
WITH CHECK (lower(email) = lower((auth.jwt() ->> 'email')) AND user_id = auth.uid());