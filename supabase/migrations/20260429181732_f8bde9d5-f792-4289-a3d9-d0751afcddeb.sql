-- Mudança 1 — Bloquear estoque negativo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.estoque_itens'::regclass
      AND conname = 'chk_estoque_itens_quantidade_nao_negativa'
  ) THEN
    ALTER TABLE public.estoque_itens
      ADD CONSTRAINT chk_estoque_itens_quantidade_nao_negativa
      CHECK (quantidade >= 0);
  END IF;
END $$;

-- Mudança 2 — Drop functions órfãs
DROP FUNCTION IF EXISTS public.trg_pecas_utilizadas_baixa() CASCADE;
DROP FUNCTION IF EXISTS public.pecas_utilizadas_after_insert() CASCADE;
DROP FUNCTION IF EXISTS public.trg_pecas_utilizadas_devolver() CASCADE;
DROP FUNCTION IF EXISTS public.pecas_utilizadas_after_delete() CASCADE;

-- Mudança 3 — Drop trigger sem efeito em ordens_de_servico
DROP TRIGGER IF EXISTS trg_baixa_estoque_os ON public.ordens_de_servico;

-- Mudança 4 — Mover tabelas backup para schema separado
CREATE SCHEMA IF NOT EXISTS archived;

ALTER TABLE IF EXISTS public.aparelhos_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.assinaturas_digitais_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.avaliacoes_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.clientes_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.comissoes_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.contas_a_pagar_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.entradas_estoque_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.entradas_estoque_itens_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.estoque_aparelhos_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.estoque_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.estoque_categorias_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.estoque_itens_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.estoque_movimentos_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.garantias_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.historico_custo_peca_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.historico_ordens_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.listas_preco_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.movimentacoes_financeiras_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.ordens_de_servico_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.os_auditoria_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.os_checklist_saida_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.os_fotos_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.os_servicos_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.os_transferencias_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.pecas_utilizadas_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.pedidos_compra_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.pedidos_compra_itens_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.recebimentos_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.servico_pecas_backup_20260428 SET SCHEMA archived;
ALTER TABLE IF EXISTS public.tipos_servico_backup_20260428 SET SCHEMA archived;