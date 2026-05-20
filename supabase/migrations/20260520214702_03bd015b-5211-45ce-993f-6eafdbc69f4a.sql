CREATE OR REPLACE FUNCTION public.marcar_grupo_aceito()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.lojista_grupos
     SET status_acesso = 'ativo',
         convite_aceito_em = COALESCE(convite_aceito_em, now())
   WHERE user_id = auth.uid()
     AND (status_acesso IS DISTINCT FROM 'ativo' OR convite_aceito_em IS NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_grupo_aceito() TO authenticated;