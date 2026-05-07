ALTER TABLE admin.usuarios_internos ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin.eventos_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin.notas_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff lê usuários internos" ON admin.usuarios_internos FOR SELECT TO authenticated USING (admin.is_staff());
CREATE POLICY "Staff lê planos" ON admin.planos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff escreve planos" ON admin.planos FOR ALL TO authenticated USING (admin.is_staff()) WITH CHECK (admin.is_staff());
CREATE POLICY "Staff lê assinaturas" ON admin.assinaturas FOR SELECT TO authenticated USING (admin.is_staff());
CREATE POLICY "Staff escreve assinaturas" ON admin.assinaturas FOR ALL TO authenticated USING (admin.is_staff()) WITH CHECK (admin.is_staff());
CREATE POLICY "Staff lê eventos billing" ON admin.eventos_billing FOR SELECT TO authenticated USING (admin.is_staff());
CREATE POLICY "Staff escreve eventos billing" ON admin.eventos_billing FOR INSERT TO authenticated WITH CHECK (admin.is_staff());
CREATE POLICY "Staff lê tickets" ON admin.tickets FOR SELECT TO authenticated USING (admin.is_staff());
CREATE POLICY "Staff escreve tickets" ON admin.tickets FOR ALL TO authenticated USING (admin.is_staff()) WITH CHECK (admin.is_staff());
CREATE POLICY "Staff lê notas" ON admin.notas_cliente FOR SELECT TO authenticated USING (admin.is_staff());
CREATE POLICY "Staff escreve notas" ON admin.notas_cliente FOR ALL TO authenticated USING (admin.is_staff()) WITH CHECK (admin.is_staff());
CREATE POLICY "Staff lê audit log" ON admin.audit_log FOR SELECT TO authenticated USING (admin.is_staff());
CREATE POLICY "Staff escreve audit log" ON admin.audit_log FOR INSERT TO authenticated WITH CHECK (admin.is_staff());

CREATE POLICY "Staff lê todas empresas" ON public.empresas FOR SELECT TO authenticated USING (admin.is_staff());
CREATE POLICY "Staff lê todos user_profiles" ON public.user_profiles FOR SELECT TO authenticated USING (admin.is_staff());
CREATE POLICY "Staff lê todas ordens_de_servico" ON public.ordens_de_servico FOR SELECT TO authenticated USING (admin.is_staff());
CREATE POLICY "Staff lê todas funcionarios" ON public.funcionarios FOR SELECT TO authenticated USING (admin.is_staff());

ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS assinatura_id uuid REFERENCES admin.assinaturas(id);

INSERT INTO admin.planos (tier, nome, descricao, preco_mensal_centavos, limite_oss_mes, limite_tecnicos, limite_lojas, features) VALUES
  ('starter', 'Starter', 'Para assistências pequenas começando', 9900, 100, 2, 1,
   '{"comissoes": true, "relatorios_basicos": true, "suporte_email": true}'::jsonb),
  ('pro', 'Pro', 'Para assistências em crescimento', 19900, 500, 10, 3,
   '{"comissoes": true, "relatorios_basicos": true, "relatorios_avancados": true, "metas": true, "exports_csv": true, "suporte_chat": true}'::jsonb),
  ('enterprise', 'Enterprise', 'Para redes e franquias', 49900, NULL, NULL, NULL,
   '{"comissoes": true, "relatorios_basicos": true, "relatorios_avancados": true, "metas": true, "exports_csv": true, "suporte_chat": true, "suporte_telefone": true, "api_publica": true, "white_label": true}'::jsonb)
ON CONFLICT (tier) DO NOTHING;