
CREATE INDEX IF NOT EXISTS idx_os_empresa_status 
  ON ordens_de_servico(empresa_id, status);

CREATE INDEX IF NOT EXISTS idx_os_data_entrada 
  ON ordens_de_servico(data_entrada DESC);

CREATE INDEX IF NOT EXISTS idx_os_aparelho_id 
  ON ordens_de_servico(aparelho_id);

CREATE INDEX IF NOT EXISTS idx_aparelhos_imei 
  ON aparelhos(imei);

CREATE INDEX IF NOT EXISTS idx_aparelhos_cliente_id 
  ON aparelhos(cliente_id);

CREATE INDEX IF NOT EXISTS idx_clientes_empresa_id 
  ON clientes(empresa_id);

CREATE INDEX IF NOT EXISTS idx_clientes_telefone 
  ON clientes(telefone);

CREATE INDEX IF NOT EXISTS idx_pecas_utilizadas_os_id 
  ON pecas_utilizadas(ordem_id);

CREATE INDEX IF NOT EXISTS idx_estoque_empresa_id 
  ON estoque_itens(empresa_id);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_vencimento 
  ON contas_a_pagar(empresa_id, data_vencimento);

CREATE INDEX IF NOT EXISTS idx_comissoes_tecnico_status 
  ON comissoes(funcionario_id, status);
