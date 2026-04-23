CREATE OR REPLACE FUNCTION public.get_clientes_com_stats()
RETURNS TABLE (
  id uuid,
  nome text,
  telefone text,
  whatsapp text,
  email text,
  cpf text,
  observacoes text,
  created_at timestamptz,
  total_os bigint,
  total_gasto numeric,
  ultimo_atendimento timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.nome,
    c.telefone,
    c.whatsapp,
    c.email,
    c.cpf,
    c.observacoes,
    c.created_at,
    COUNT(os.id) FILTER (
      WHERE os.status != 'cancelado'
      AND os.deleted_at IS NULL
    ) AS total_os,
    COALESCE(SUM(os.valor) FILTER (
      WHERE os.status IN ('entregue', 'pronto')
      AND os.deleted_at IS NULL
    ), 0) AS total_gasto,
    MAX(COALESCE(os.data_conclusao, os.data_entrada)) FILTER (
      WHERE os.status != 'cancelado'
      AND os.deleted_at IS NULL
    ) AS ultimo_atendimento
  FROM clientes c
  LEFT JOIN aparelhos a ON a.cliente_id = c.id
  LEFT JOIN ordens_de_servico os ON os.aparelho_id = a.id
  WHERE c.deleted_at IS NULL
    AND c.empresa_id = get_my_empresa_id()
  GROUP BY c.id
  ORDER BY c.nome;
$$;