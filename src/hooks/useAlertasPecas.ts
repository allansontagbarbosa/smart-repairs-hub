import { useMemo } from "react";
import type { GenericAlert } from "@/components/AlertsBanner";

type Peca = {
  id: string;
  nome: string;
  quantidade: number;
  quantidade_minima: number;
  categoria?: string | null;
};

export function useAlertasPecas(pecas: Peca[]): GenericAlert[] {
  return useMemo(() => {
    const alertas: GenericAlert[] = [];

    for (const p of pecas) {
      if (p.quantidade_minima > 0 && p.quantidade <= p.quantidade_minima) {
        const nivel = p.quantidade === 0 ? "danger" : "warning";
        alertas.push({
          type: nivel,
          message:
            p.quantidade === 0
              ? `Peça "${p.nome}" esgotada — estoque zerado`
              : `Peça "${p.nome}" com estoque baixo: ${p.quantidade}/${p.quantidade_minima}`,
        });
      }
    }

    const priority = { danger: 0, warning: 1, info: 2 };
    alertas.sort((a, b) => priority[a.type] - priority[b.type]);
    return alertas;
  }, [pecas]);
}
