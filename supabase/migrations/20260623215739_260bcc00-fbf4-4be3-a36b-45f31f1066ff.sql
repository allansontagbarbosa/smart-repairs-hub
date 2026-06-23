UPDATE public.perfis_acesso p
SET permissoes = jsonb_build_object(
  'atacado_dashboard',     jsonb_build_object('ver',true, 'criar',false,'editar',false,'excluir',false),
  'atacado_pedidos',       jsonb_build_object('ver',true, 'criar',true, 'editar',false,'excluir',false),
  'atacado_clientes',      jsonb_build_object('ver',true, 'criar',false,'editar',false,'excluir',false),
  'atacado_aparelhos',     jsonb_build_object('ver',true, 'criar',false,'editar',false,'excluir',false),
  'atacado_metas',         jsonb_build_object('ver',true, 'criar',false,'editar',false,'excluir',false)
)
WHERE p.nome_perfil = 'Vendedor'
  AND p.permissoes ? 'atacado_vendedor'
  AND p.empresa_id IN (SELECT id FROM public.empresas WHERE modulo_atacado_ativo = true);