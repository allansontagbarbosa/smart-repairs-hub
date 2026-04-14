-- Allow portal clients to update their own orders (for approval/rejection)
CREATE POLICY "Portal client update own orders"
  ON public.ordens_de_servico
  FOR UPDATE
  TO authenticated
  USING (
    (NOT is_internal_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM aparelhos a
      JOIN clientes c ON c.id = a.cliente_id
      WHERE a.id = ordens_de_servico.aparelho_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    (NOT is_internal_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM aparelhos a
      JOIN clientes c ON c.id = a.cliente_id
      WHERE a.id = ordens_de_servico.aparelho_id AND c.user_id = auth.uid()
    )
  );

-- Allow portal clients to insert history for their own orders
CREATE POLICY "Portal client insert own history"
  ON public.historico_ordens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (NOT is_internal_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM ordens_de_servico o
      JOIN aparelhos a ON a.id = o.aparelho_id
      JOIN clientes c ON c.id = a.cliente_id
      WHERE o.id = historico_ordens.ordem_id AND c.user_id = auth.uid()
    )
  );

-- Insert message templates for approval/rejection
INSERT INTO public.templates_mensagem (evento, titulo, mensagem) VALUES
  ('orcamento_aprovado', 'Orçamento Aprovado pelo Cliente',
   'O cliente {cliente} APROVOU o orçamento de R$ {valor} para a OS #{numero}. Aparelho: {aparelho}.'),
  ('orcamento_recusado', 'Orçamento Recusado pelo Cliente',
   'O cliente {cliente} RECUSOU o orçamento para a OS #{numero}. Aparelho: {aparelho}. Motivo: {motivo}.')
ON CONFLICT DO NOTHING;