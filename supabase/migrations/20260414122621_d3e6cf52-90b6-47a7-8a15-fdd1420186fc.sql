
-- Limpar dados de demonstração
-- ATENÇÃO: apaga TODOS os dados operacionais

DELETE FROM public.pecas_utilizadas;
DELETE FROM public.os_defeitos;
DELETE FROM public.historico_ordens;
DELETE FROM public.garantias;
DELETE FROM public.avaliacoes;
DELETE FROM public.comissoes;
DELETE FROM public.movimentacoes_financeiras;
DELETE FROM public.recebimentos;
DELETE FROM public.contas_a_pagar WHERE descricao ILIKE '%demo%' OR descricao ILIKE '%teste%';
DELETE FROM public.ordens_de_servico;
DELETE FROM public.aparelhos;
DELETE FROM public.clientes WHERE nome IN (
  'Ana Costa', 'João Santos', 'Maria Silva', 'Pedro Lima',
  'Carlos Oliveira', 'Fernanda Souza'
);
DELETE FROM public.estoque_itens WHERE nome_personalizado ILIKE '%demo%' OR nome_personalizado ILIKE '%teste%';

-- Resetar sequência de numeração de OS
ALTER SEQUENCE IF EXISTS ordens_de_servico_numero_seq RESTART WITH 1;
