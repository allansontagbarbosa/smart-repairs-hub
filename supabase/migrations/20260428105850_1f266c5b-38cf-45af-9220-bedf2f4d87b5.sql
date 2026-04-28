-- Remover triggers legados conflitantes com a nova lógica consolidada
DROP TRIGGER IF EXISTS trg_comissao_automatica ON public.ordens_de_servico;
DROP TRIGGER IF EXISTS trg_gerar_receita_entrega ON public.ordens_de_servico;