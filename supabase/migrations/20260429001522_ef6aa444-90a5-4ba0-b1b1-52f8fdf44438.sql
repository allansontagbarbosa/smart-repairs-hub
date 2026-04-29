REVOKE ALL ON FUNCTION public.get_saldo_cliente(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_saldos_clientes_resumo() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_extrato_cliente(uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_pagamento_cliente(uuid, numeric, text, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gerar_movimentacao_pagamento_cliente() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.get_saldo_cliente(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_saldos_clientes_resumo() FROM anon;
REVOKE ALL ON FUNCTION public.get_extrato_cliente(uuid, date, date) FROM anon;
REVOKE ALL ON FUNCTION public.criar_pagamento_cliente(uuid, numeric, text, date, text) FROM anon;
REVOKE ALL ON FUNCTION public.gerar_movimentacao_pagamento_cliente() FROM anon;

GRANT EXECUTE ON FUNCTION public.get_saldo_cliente(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_saldos_clientes_resumo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_extrato_cliente(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_pagamento_cliente(uuid, numeric, text, date, text) TO authenticated;