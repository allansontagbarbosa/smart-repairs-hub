CREATE OR REPLACE FUNCTION public.compras_lista_do_dia()
RETURNS TABLE (
  peca_chave text,
  peca_id uuid,
  peca_nome text,
  quantidade_total bigint,
  ultimo_custo numeric,
  os_list jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH itens AS (
    SELECT
      pu.peca_id::text AS peca_chave,
      pu.peca_id,
      COALESCE(NULLIF(TRIM(ei.nome_personalizado), ''), 'Peça sem nome') AS peca_nome,
      pu.quantidade,
      pu.custo_unitario,
      pu.created_at AS pu_created,
      o.id AS os_id,
      o.numero AS os_numero,
      c.nome AS cliente_nome,
      o.pecas_pedido_em
    FROM public.ordens_de_servico o
    JOIN public.pecas_utilizadas pu ON pu.ordem_id = o.id
    LEFT JOIN public.estoque_itens ei ON ei.id = pu.peca_id
    LEFT JOIN public.aparelhos a ON a.id = o.aparelho_id
    LEFT JOIN public.clientes c ON c.id = a.cliente_id
    WHERE o.empresa_id = public.get_my_empresa_id()
      AND o.deleted_at IS NULL
      AND o.status = 'aguardando_peca'
  )
  SELECT
    i.peca_chave,
    i.peca_id,
    MAX(i.peca_nome) AS peca_nome,
    SUM(i.quantidade)::bigint AS quantidade_total,
    MAX(ei2.custo_medio) AS ultimo_custo,
    jsonb_agg(DISTINCT jsonb_build_object(
      'os_id', i.os_id,
      'numero', i.os_numero,
      'cliente', i.cliente_nome,
      'desde', COALESCE(i.pecas_pedido_em, i.pu_created)
    )) AS os_list
  FROM itens i
  LEFT JOIN public.estoque_itens ei2 ON ei2.id = i.peca_id
  GROUP BY i.peca_chave, i.peca_id
  ORDER BY quantidade_total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.compras_lista_do_dia() TO authenticated;