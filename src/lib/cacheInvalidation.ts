import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalida todas as queries derivadas de ordens_de_servico.
 * Use após qualquer mutation que cria, edita, cancela, muda status,
 * altera técnico, peças ou serviços de uma OS.
 *
 * Trade-off: invalida em excesso, mas garante UI sempre consistente.
 * Otimizar com invalidação seletiva quando o volume crescer.
 */
export function invalidateOrdensDependentes(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["ordens"] }),
    queryClient.invalidateQueries({ queryKey: ["ordens_fin"] }),
    queryClient.invalidateQueries({ queryKey: ["aparelhos_assistencia"] }),
    queryClient.invalidateQueries({ queryKey: ["tecnico-minhas-os"] }),
    queryClient.invalidateQueries({ queryKey: ["tecnico-metricas"] }),
    queryClient.invalidateQueries({ queryKey: ["clientes-full"] }),
    queryClient.invalidateQueries({ queryKey: ["comissoes"] }),
    queryClient.invalidateQueries({ queryKey: ["os-aguardando-aprovacao-count"] }),
    queryClient.invalidateQueries({ queryKey: ["os-atrasadas-count"] }),
    queryClient.invalidateQueries({ queryKey: ["estoque_baixo_count"] }),
  ]);
}
