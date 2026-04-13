
create or replace function public.get_dashboard_summary()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'ordens', (
      select coalesce(json_agg(row_to_json(o)), '[]'::json)
      from (
        select
          os.id, os.numero, os.status, os.data_entrada,
          os.data_conclusao, os.previsao_entrega,
          os.valor, os.custo_pecas, os.loja_id,
          json_build_object(
            'marca', a.marca,
            'modelo', a.modelo,
            'imei', a.imei,
            'clientes', json_build_object(
              'nome', c.nome,
              'telefone', c.telefone
            )
          ) as aparelhos
        from ordens_de_servico os
        left join aparelhos a on a.id = os.aparelho_id
        left join clientes c on c.id = a.cliente_id
        where os.deleted_at is null
        order by os.data_entrada desc
      ) o
    ),
    'estoque_baixo', (
      select count(*) from estoque
      where quantidade_minima > 0 and quantidade <= quantidade_minima
    ),
    'contas_pendentes', (
      select coalesce(json_agg(row_to_json(cp)), '[]'::json)
      from contas_a_pagar cp
      where cp.status = 'pendente'
    ),
    'comissoes_pendentes', (
      select coalesce(json_agg(row_to_json(co)), '[]'::json)
      from comissoes co
      where co.status = 'pendente'
    ),
    'lojas', (
      select coalesce(json_agg(row_to_json(l)), '[]'::json)
      from lojas l
      where l.ativo = true
    )
  );
$$;
