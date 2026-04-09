import { useMemo } from "react";
import { differenceInDays } from "date-fns";

type OrderWithRelations = {
  id: string;
  numero: number;
  status: string;
  data_entrada: string;
  previsao_entrega: string | null;
  aparelhos?: {
    marca: string;
    modelo: string;
    clientes?: { nome: string } | null;
  } | null;
};

export type Alerta = {
  type: "danger" | "warning" | "info";
  message: string;
  orderId: string;
};

const DIAS_PARADO_ALERTA = 5;
const DIAS_PRONTO_ALERTA = 3;

export function useAlertas(orders: OrderWithRelations[]) {
  return useMemo(() => {
    const now = new Date();
    const alertas: Alerta[] = [];

    for (const o of orders) {
      if (o.status === "entregue") continue;

      const cliente = o.aparelhos?.clientes?.nome ?? "Cliente";
      const aparelho = `${o.aparelhos?.marca ?? ""} ${o.aparelhos?.modelo ?? ""}`.trim() || "Aparelho";
      const dias = differenceInDays(now, new Date(o.data_entrada));
      const osLabel = `OS #${String(o.numero).padStart(3, "0")}`;

      // Previsão de entrega vencida
      if (o.previsao_entrega && new Date(o.previsao_entrega) < now && o.status !== "pronto") {
        alertas.push({
          type: "danger",
          message: `${osLabel} — ${aparelho} de ${cliente} com previsão de entrega vencida`,
          orderId: o.id,
        });
      }

      // Parado há muitos dias (não pronto/entregue)
      if (dias >= DIAS_PARADO_ALERTA && !["pronto", "entregue"].includes(o.status)) {
        alertas.push({
          type: "warning",
          message: `${osLabel} — ${aparelho} de ${cliente} parado há ${dias} dias (${o.status.replace(/_/g, " ")})`,
          orderId: o.id,
        });
      }

      // Aguardando aprovação
      if (o.status === "aguardando_aprovacao") {
        alertas.push({
          type: "info",
          message: `${osLabel} — ${aparelho} de ${cliente} aguardando aprovação do cliente`,
          orderId: o.id,
        });
      }

      // Pronto mas não entregue
      if (o.status === "pronto") {
        alertas.push({
          type: "warning",
          message: `${osLabel} — ${aparelho} de ${cliente} pronto há ${dias} dias — aguardando retirada`,
          orderId: o.id,
        });
      }
    }

    // Sort: danger first, then warning, then info
    const priority = { danger: 0, warning: 1, info: 2 };
    alertas.sort((a, b) => priority[a.type] - priority[b.type]);

    return alertas;
  }, [orders]);
}
