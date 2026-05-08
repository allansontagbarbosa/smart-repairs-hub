CREATE POLICY "Owner insere staff" ON admin.usuarios_internos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin.usuarios_internos
      WHERE user_id = auth.uid() AND role = 'owner' AND ativo = true
    )
  );

CREATE POLICY "Owner atualiza staff" ON admin.usuarios_internos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin.usuarios_internos
      WHERE user_id = auth.uid() AND role = 'owner' AND ativo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin.usuarios_internos
      WHERE user_id = auth.uid() AND role = 'owner' AND ativo = true
    )
  );

CREATE POLICY "Owner deleta staff" ON admin.usuarios_internos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin.usuarios_internos
      WHERE user_id = auth.uid() AND role = 'owner' AND ativo = true
    )
  );