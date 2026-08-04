UPDATE public.comissoes c
SET valor = s.comissao,
    valor_base = s.comissao,
    updated_at = now()
FROM public.os_servicos s
WHERE c.os_servico_id = s.id
  AND c.estornada_em IS NULL
  AND c.status IN ('pendente', 'liberada')
  AND abs(COALESCE(c.valor, 0) - COALESCE(s.comissao, 0)) > 0.01;