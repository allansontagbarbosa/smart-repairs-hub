import { useMemo } from "react";
import { differenceInDays } from "date-fns";

type OrderWithRelations = {
  id: string;
  numero: number;
  status: string;
  data_entrada: string;
  data_conclusao: string | null;
  previsao_entrega: string | null;
  aparelhos?: {
    marca: string;
    modelo: string;
    clientes?: { nome: string; telefone: string } | null;
  } | null;
};

export type SugestaoAcao = "whatsapp_retirada" | "cobrar_aprovacao" | "verificar_status" | "entregar";

export type Alerta = {
  type: "danger" | "warning" | "info";
  message: string;
  orderId: string;
  sugestao?: string;
  acoes: SugestaoAcao[];
  phone?: string;
};

const DIAS_PARADO_ALERTA = 5;
const DIAS_PRONTO_RETIRADA = 2;

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
      const phone = o.aparelhos?.clientes?.telefone;

      // Pronto há mais de X dias → sugerir mensagem de retirada
      if (o.status === "pronto") {
        const diasPronto = o.data_conclusao
          ? differenceInDays(now, new Date(o.data_conclusao))
          : dias;

        const acoes: SugestaoAcao[] = ["entregar"];
        if (phone) acoes.unshift("whatsapp_retirada");

        alertas.push({
          type: diasPronto >= DIAS_PRONTO_RETIRADA ? "danger" : "warning",
          message: `${osLabel} — ${aparelho} de ${cliente} pronto há ${diasPronto} dia(s)`,
          sugestao: diasPronto >= DIAS_PRONTO_RETIRADA
            ? "Enviar mensagem para retirada"
            : "Aguardando retirada do cliente",
          orderId: o.id,
          acoes,
          phone,
        });
        continue;
      }

      // Aguardando aprovação → sugerir cobrança
      if (o.status === "aguardando_aprovacao") {
        const acoes: SugestaoAcao[] = [];
        if (phone) acoes.push("cobrar_aprovacao");

        alertas.push({
          type: "warning",
          message: `${osLabel} — ${aparelho} de ${cliente} aguardando aprovação`,
          sugestao: "Cobrar cliente sobre aprovação",
          orderId: o.id,
          acoes,
          phone,
        });
        continue;
      }

      // Previsão vencida
      if (o.previsao_entrega && new Date(o.previsao_entrega) < now) {
        const acoes: SugestaoAcao[] = ["verificar_status"];
        if (phone) acoes.push("cobrar_aprovacao");

        alertas.push({
          type: "danger",
          message: `${osLabel} — ${aparelho} de ${cliente} com prazo vencido`,
          sugestao: "Verificar status e atualizar cliente",
          orderId: o.id,
          acoes,
          phone,
        });
        continue;
      }

      // Parado há muitos dias
      if (dias >= DIAS_PARADO_ALERTA) {
        alertas.push({
          type: "warning",
          message: `${osLabel} — ${aparelho} de ${cliente} parado há ${dias} dias`,
          sugestao: "Verificar status do reparo",
          orderId: o.id,
          acoes: ["verificar_status"],
          phone,
        });
      }
    }

    const priority = { danger: 0, warning: 1, info: 2 };
    alertas.sort((a, b) => priority[a.type] - priority[b.type]);

    return alertas;
  }, [orders]);
}
