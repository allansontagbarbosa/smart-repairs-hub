CREATE OR REPLACE FUNCTION public.calc_meta_faturamento(p_inicio date, p_fim date, p_escopo text, p_escopo_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(o.valor_total), 0) FROM ordens_de_servico o
  WHERE o.empresa_id = public.get_my_empresa_id() AND o.deleted_at IS NULL
    AND o.data_conclusao::date BETWEEN p_inicio AND p_fim
    AND (p_escopo = 'empresa' OR (p_escopo = 'loja' AND o.loja_id = p_escopo_id));
$$;

CREATE OR REPLACE FUNCTION public.calc_meta_qtd_os(p_inicio date, p_fim date, p_escopo text, p_escopo_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(DISTINCT o.id)::numeric FROM ordens_de_servico o
  WHERE o.empresa_id = public.get_my_empresa_id() AND o.deleted_at IS NULL
    AND o.data_conclusao::date BETWEEN p_inicio AND p_fim
    AND (
      p_escopo = 'empresa'
      OR (p_escopo = 'loja' AND o.loja_id = p_escopo_id)
      OR (p_escopo = 'tecnico' AND EXISTS (
        SELECT 1 FROM os_servicos s WHERE s.ordem_id = o.id AND s.tecnico_id = p_escopo_id AND s.status = 'concluido'
      ))
    );
$$;

CREATE OR REPLACE FUNCTION public.calc_meta_qtd_servicos(p_inicio date, p_fim date, p_escopo text, p_escopo_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::numeric FROM os_servicos s JOIN ordens_de_servico o ON o.id = s.ordem_id
  WHERE s.empresa_id = public.get_my_empresa_id() AND o.deleted_at IS NULL AND s.status = 'concluido'
    AND s.concluido_em::date BETWEEN p_inicio AND p_fim
    AND (
      p_escopo = 'empresa'
      OR (p_escopo = 'tecnico' AND s.tecnico_id = p_escopo_id)
      OR (p_escopo = 'loja' AND o.loja_id = p_escopo_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.calc_meta_ticket_medio(p_inicio date, p_fim date, p_escopo text, p_escopo_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(AVG(o.valor_total), 0) FROM ordens_de_servico o
  WHERE o.empresa_id = public.get_my_empresa_id() AND o.deleted_at IS NULL
    AND o.data_conclusao::date BETWEEN p_inicio AND p_fim
    AND (p_escopo = 'empresa' OR (p_escopo = 'loja' AND o.loja_id = p_escopo_id));
$$;

CREATE OR REPLACE FUNCTION public.calc_meta_comissao_paga(p_inicio date, p_fim date, p_escopo text, p_escopo_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(c.valor), 0) FROM comissoes c
  WHERE c.empresa_id = public.get_my_empresa_id()
    AND c.estornada_em IS NULL AND c.status = 'paga' AND c.data_pagamento IS NOT NULL
    AND c.data_pagamento::date BETWEEN p_inicio AND p_fim
    AND (p_escopo = 'empresa' OR (p_escopo = 'tecnico' AND c.funcionario_id = p_escopo_id));
$$;

GRANT EXECUTE ON FUNCTION public.calc_meta_faturamento(date, date, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_meta_qtd_os(date, date, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_meta_qtd_servicos(date, date, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_meta_ticket_medio(date, date, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calc_meta_comissao_paga(date, date, text, uuid) TO authenticated;