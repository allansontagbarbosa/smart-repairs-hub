BEGIN;

DROP POLICY IF EXISTS "Empresa isolada" ON public.avaliacoes_fornecedor;
DROP POLICY IF EXISTS "Empresa isolada" ON public.comissoes_servico;
DROP POLICY IF EXISTS "Empresa isolada" ON public.conferencia_itens;
DROP POLICY IF EXISTS "Empresa isolada" ON public.conferencias_estoque;
DROP POLICY IF EXISTS "Empresa isolada" ON public.contas_a_pagar;
DROP POLICY IF EXISTS "Empresa isolada" ON public.entradas_estoque;
DROP POLICY IF EXISTS "Empresa isolada" ON public.entradas_estoque_itens;
DROP POLICY IF EXISTS "Empresa isolada" ON public.estoque_aparelhos;
DROP POLICY IF EXISTS "Empresa isolada" ON public.estoque_movimentos;
DROP POLICY IF EXISTS "Empresa isolada" ON public.fornecedores;
DROP POLICY IF EXISTS "Empresa isolada" ON public.historico_custo_peca;
DROP POLICY IF EXISTS "Empresa isolada" ON public.movimentacoes_financeiras;
DROP POLICY IF EXISTS "Empresa isolada" ON public.pedidos_compra;
DROP POLICY IF EXISTS "Empresa isolada" ON public.pedidos_compra_itens;

DROP POLICY IF EXISTS "contas_pagar_pagamentos_all" ON public.contas_pagar_pagamentos;
DROP POLICY IF EXISTS "imports_empresa_isolada" ON public.funcionario_importacoes_ponto;
DROP POLICY IF EXISTS "movs_empresa_isolada" ON public.funcionario_movimentacoes;
DROP POLICY IF EXISTS "ponto_empresa_isolada" ON public.funcionario_ponto_entradas;

DROP POLICY IF EXISTS "Lotes — empresa pode atualizar" ON public.estoque_lotes;
DROP POLICY IF EXISTS "Lotes — empresa pode deletar" ON public.estoque_lotes;
DROP POLICY IF EXISTS "Lotes — empresa pode inserir" ON public.estoque_lotes;
DROP POLICY IF EXISTS "Lotes — empresa pode ler" ON public.estoque_lotes;
DROP POLICY IF EXISTS "PUL — empresa pode deletar" ON public.pecas_utilizadas_lotes;
DROP POLICY IF EXISTS "PUL — empresa pode inserir" ON public.pecas_utilizadas_lotes;
DROP POLICY IF EXISTS "PUL — empresa pode ler" ON public.pecas_utilizadas_lotes;

COMMIT;