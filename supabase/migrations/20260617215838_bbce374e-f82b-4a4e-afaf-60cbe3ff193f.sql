
-- Remove broad tenant_isolation ALL policies on tables that already have per-command perm_* policies.
-- Those broad ALL PERMISSIVE policies were OR'd with the per-command ones, bypassing permission checks.

DROP POLICY IF EXISTS tenant_isolation ON public.pecas_utilizadas;
DROP POLICY IF EXISTS tenant_isolation ON public.pedidos_compra;
DROP POLICY IF EXISTS tenant_isolation ON public.pedidos_compra_itens;
DROP POLICY IF EXISTS tenant_isolation ON public.movimentacoes_financeiras;
DROP POLICY IF EXISTS tenant_isolation ON public.funcionario_movimentacoes;
DROP POLICY IF EXISTS tenant_isolation ON public.comissoes;
DROP POLICY IF EXISTS tenant_isolation ON public.comissoes_servico;
DROP POLICY IF EXISTS tenant_isolation ON public.estoque_itens;
DROP POLICY IF EXISTS tenant_isolation ON public.estoque_movimentos;
DROP POLICY IF EXISTS tenant_isolation ON public.estoque_lotes;
DROP POLICY IF EXISTS tenant_isolation ON public.historico_custo_peca;
DROP POLICY IF EXISTS tenant_isolation ON public.conferencias_estoque;
DROP POLICY IF EXISTS tenant_isolation ON public.conferencia_itens;
DROP POLICY IF EXISTS tenant_isolation ON public.entradas_estoque;
DROP POLICY IF EXISTS tenant_isolation ON public.entradas_estoque_itens;
DROP POLICY IF EXISTS tenant_isolation ON public.lojista_faturas;
DROP POLICY IF EXISTS tenant_isolation ON public.os_servicos;
DROP POLICY IF EXISTS tenant_isolation ON public.os_fotos;
DROP POLICY IF EXISTS tenant_isolation ON public.os_checklist_saida;
DROP POLICY IF EXISTS tenant_isolation ON public.funcionario_ponto_entradas;
DROP POLICY IF EXISTS tenant_isolation ON public.funcionario_importacoes_ponto;
DROP POLICY IF EXISTS tenant_isolation ON public.estoque_aparelhos;
DROP POLICY IF EXISTS tenant_isolation ON public.aparelhos;
DROP POLICY IF EXISTS tenant_isolation ON public.auditoria;
DROP POLICY IF EXISTS tenant_isolation ON public.fornecedores;
DROP POLICY IF EXISTS tenant_isolation ON public.contas_pagar_pagamentos;

-- aparelhos also had a legacy ALL policy that bypassed perm_* checks for internal users.
DROP POLICY IF EXISTS "Empresa isolada" ON public.aparelhos;
