REVOKE EXECUTE ON FUNCTION public.liberar_comissao(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pagar_comissao(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pagar_comissoes_em_lote(uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.liberar_comissao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pagar_comissao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pagar_comissoes_em_lote(uuid[]) TO authenticated;