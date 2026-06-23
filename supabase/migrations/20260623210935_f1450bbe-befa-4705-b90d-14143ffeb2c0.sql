INSERT INTO public.perfis_acesso (empresa_id, nome_perfil, descricao, permissoes, ativo)
SELECT
  e.id,
  'Vendedor',
  'Vendedor B2B do atacado (acesso restrito)',
  jsonb_build_object(
    'atacado_vendedor', jsonb_build_object(
      'criar_pedido', true,
      'ver_clientes', true,
      'ver_metas_comissoes', true,
      'ver_catalogo', true,
      'ver_custo', false
    )
  ),
  true
FROM public.empresas e
WHERE e.modulo_atacado_ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.perfis_acesso pa
    WHERE pa.empresa_id = e.id AND pa.nome_perfil = 'Vendedor'
  );