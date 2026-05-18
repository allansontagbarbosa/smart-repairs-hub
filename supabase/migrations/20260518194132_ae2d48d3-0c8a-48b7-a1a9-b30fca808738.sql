BEGIN;

UPDATE public.perfis_acesso
SET permissoes = permissoes || jsonb_build_object(
  'desempenho_tecnicos', true,
  'paineis_tv', true,
  'aparelhos',     jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',true),
  'compras',       jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',true),
  'fornecedores',  jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',true),
  'faturas_b2b',   jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',true),
  'metas',         jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',true),
  'rh',            jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',true)
)
WHERE LOWER(nome_perfil) IN ('administrador', 'admin');

UPDATE public.perfis_acesso
SET permissoes = permissoes || jsonb_build_object(
  'desempenho_tecnicos', true,
  'paineis_tv', true,
  'aparelhos',     jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',false),
  'compras',       jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',false),
  'fornecedores',  jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',false),
  'faturas_b2b',   jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',false),
  'metas',         jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',true),
  'rh',            jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',false)
)
WHERE LOWER(nome_perfil) = 'gerente';

UPDATE public.perfis_acesso
SET permissoes = permissoes || jsonb_build_object(
  'desempenho_tecnicos', true,
  'paineis_tv', false,
  'aparelhos',     jsonb_build_object('ver',false,'criar',false,'editar',false,'excluir',false),
  'compras',       jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',false),
  'fornecedores',  jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',false),
  'faturas_b2b',   jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',false),
  'metas',         jsonb_build_object('ver',true,'criar',false,'editar',false,'excluir',false),
  'rh',            jsonb_build_object('ver',true,'criar',false,'editar',false,'excluir',false)
)
WHERE LOWER(nome_perfil) = 'financeiro';

UPDATE public.perfis_acesso
SET permissoes = permissoes || jsonb_build_object(
  'desempenho_tecnicos', false,
  'paineis_tv', true,
  'aparelhos',     jsonb_build_object('ver',true,'criar',true,'editar',true,'excluir',false),
  'compras',       jsonb_build_object('ver',false,'criar',false,'editar',false,'excluir',false),
  'fornecedores',  jsonb_build_object('ver',false,'criar',false,'editar',false,'excluir',false),
  'faturas_b2b',   jsonb_build_object('ver',false,'criar',false,'editar',false,'excluir',false),
  'metas',         jsonb_build_object('ver',false,'criar',false,'editar',false,'excluir',false),
  'rh',            jsonb_build_object('ver',false,'criar',false,'editar',false,'excluir',false)
)
WHERE LOWER(nome_perfil) IN ('atendimento', 'atendente');

UPDATE public.perfis_acesso
SET permissoes = permissoes || jsonb_build_object(
  'desempenho_tecnicos', false,
  'paineis_tv', false,
  'aparelhos',     jsonb_build_object('ver',true,'criar',false,'editar',false,'excluir',false),
  'compras',       jsonb_build_object('ver',false,'criar',false,'editar',false,'excluir',false),
  'fornecedores',  jsonb_build_object('ver',false,'criar',false,'editar',false,'excluir',false),
  'faturas_b2b',   jsonb_build_object('ver',false,'criar',false,'editar',false,'excluir',false),
  'metas',         jsonb_build_object('ver',true,'criar',false,'editar',false,'excluir',false),
  'rh',            jsonb_build_object('ver',false,'criar',false,'editar',false,'excluir',false)
)
WHERE LOWER(nome_perfil) IN ('tecnico', 'técnico');

COMMIT;