import { differenceInDays } from "date-fns";

export type Prioridade = "critica" | "atencao" | "normal";

interface PrioridadeResult {
  nivel: Prioridade;
  label: string;
  motivo: string;
}

const DIAS_CRITICO = 5; // parado há mais de 5 dias sem previsão, ou prazo vencido
const DIAS_ATENCAO = 2; // prazo vence em 2 dias ou menos

/**
 * Calcula a prioridade automática de uma OS com base em prazos e tempo parado.
 */
export function calcularPrioridade(
  status: string,
  dataEntrada: string,
  previsaoEntrega: string | null,
): PrioridadeResult {
  // Ordens finalizadas não têm prioridade operacional
  if (status === "entregue") {
    return { nivel: "normal", label: "Normal", motivo: "Entregue" };
  }

  const hoje = new Date();

  // Se tem previsão de entrega, verificar prazo
  if (previsaoEntrega) {
    const prazo = new Date(previsaoEntrega);
    const diasRestantes = differenceInDays(prazo, hoje);

    if (diasRestantes < 0) {
      return {
        nivel: "critica",
        label: "Atrasada",
        motivo: `Prazo vencido há ${Math.abs(diasRestantes)} dia(s)`,
      };
    }
    if (diasRestantes <= DIAS_ATENCAO) {
      return {
        nivel: "atencao",
        label: "Atenção",
        motivo: `Prazo em ${diasRestantes} dia(s)`,
      };
    }
    return { nivel: "normal", label: "No prazo", motivo: `${diasRestantes} dias restantes` };
  }

  // Sem previsão — verificar tempo parado
  const diasParado = differenceInDays(hoje, new Date(dataEntrada));
  if (diasParado > DIAS_CRITICO) {
    return {
      nivel: "critica",
      label: "Parada",
      motivo: `${diasParado} dias sem movimentação`,
    };
  }
  if (diasParado >= DIAS_CRITICO - 1) {
    return {
      nivel: "atencao",
      label: "Atenção",
      motivo: `${diasParado} dias sem previsão`,
    };
  }

  return { nivel: "normal", label: "Normal", motivo: "Dentro do prazo" };
}
