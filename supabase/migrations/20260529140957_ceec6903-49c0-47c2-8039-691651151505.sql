-- Make service-role-only intent explicit for rate_limit_tentativas.
-- Edge functions (service_role) bypass RLS; client roles must be denied.
GRANT ALL ON public.rate_limit_tentativas TO service_role;
REVOKE ALL ON public.rate_limit_tentativas FROM anon, authenticated;

CREATE POLICY "rate_limit_deny_anon_select" ON public.rate_limit_tentativas
  FOR SELECT TO anon, authenticated USING (false);
CREATE POLICY "rate_limit_deny_anon_insert" ON public.rate_limit_tentativas
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "rate_limit_deny_anon_update" ON public.rate_limit_tentativas
  FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "rate_limit_deny_anon_delete" ON public.rate_limit_tentativas
  FOR DELETE TO anon, authenticated USING (false);

COMMENT ON TABLE public.rate_limit_tentativas IS
  'Service-role-only. Managed exclusively by edge functions. Client roles are explicitly denied via RLS policies.';