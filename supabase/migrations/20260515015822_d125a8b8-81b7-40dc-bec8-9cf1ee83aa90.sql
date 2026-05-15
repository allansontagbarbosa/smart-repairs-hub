-- Aposenta o sistema legacy de lojistas
-- O único registro restante (Bruspy) era de teste; lojistas reais já vivem em public.clientes (tipo_cliente='lojista_b2b').

UPDATE public.lojistas
   SET deleted_at = NOW()
 WHERE deleted_at IS NULL;

COMMENT ON TABLE public.lojistas IS
  'DEPRECATED 2026-05-15. Lojistas migrados para public.clientes WHERE tipo_cliente = ''lojista_b2b''. Esta tabela é mantida apenas para histórico. NÃO inserir novos registros.';

COMMENT ON COLUMN public.ordens_de_servico.lojista_id IS
  'DEPRECATED 2026-05-15. Mantido para histórico. Novas OSs vinculam cliente via aparelhos.cliente_id.';