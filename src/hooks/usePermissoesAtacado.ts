import { usePermissoes } from "./usePermissoes";

export function usePermissoesAtacado() {
  const { can } = usePermissoes();

  return {
    podeVerDashboard: can("atacado_dashboard", "ver"),
    podeVerPedidos: can("atacado_pedidos", "ver"),
    podeCriarPedido: can("atacado_pedidos", "editar"),
    podeAprovarPedido: can("atacado_pedidos", "editar"),
    podeVerClientes: can("atacado_clientes", "ver"),
    podeEditarClientes: can("atacado_clientes", "editar"),
    podeVerEstoque: can("atacado_aparelhos", "ver"),
    podeEditarEstoque: can("atacado_aparelhos", "editar"),
    podeVerTabelas: can("atacado_tabelas_preco", "ver"),
    podeEditarTabelas: can("atacado_tabelas_preco", "editar"),
    podeVerFinanceiro: can("atacado_financeiro", "ver"),
    podeVerCobranca: can("atacado_cobranca", "ver"),
    podeVerRelatorios: can("atacado_relatorios", "ver"),
    podeConfigurar: can("atacado_configuracoes", "editar"),
  };
}
