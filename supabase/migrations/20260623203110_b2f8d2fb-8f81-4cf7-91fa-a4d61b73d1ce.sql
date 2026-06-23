INSERT INTO public.atacado_status_aparelho (empresa_id, nome, cor, ordem, categoria)
SELECT
  e.id,
  'Compra',
  '#A78BFA',
  coalesce((SELECT max(s.ordem) FROM public.atacado_status_aparelho s WHERE s.empresa_id = e.id), 0) + 1,
  'outro'
FROM public.empresas e
WHERE e.modulo_atacado_ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM public.atacado_status_aparelho s
    WHERE s.empresa_id = e.id AND lower(s.nome) = 'compra'
  );