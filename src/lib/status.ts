import type { Database } from "@/integrations/supabase/types";

export type Status = Database["public"]["Enums"]["status_ordem"];

export const statusFlow: Status[] = [
  "recebido", "em_analise", "aguardando_aprovacao",
  "aprovado", "em_reparo", "aguardando_peca", "pronto", "entregue",
];

/** Labels curtos para uso interno (sidebar, tabelas, fluxo) */
export const statusLabels: Record<Status, string> = {
  recebido: "Recebido",
  em_analise: "Em Análise",
  aguardando_aprovacao: "Aguard. Aprovação",
  aprovado: "Aprovado",
  em_reparo: "Em Reparo",
  aguardando_peca: "Aguard. Peça",
  pronto: "Pronto",
  entregue: "Entregue",
};

/** Labels completos para exibição ao cliente (portal, consulta) */
export const statusLabelsCliente: Record<Status, string> = {
  recebido: "Recebido",
  em_analise: "Em Análise",
  aguardando_aprovacao: "Aguardando Aprovação",
  aprovado: "Aprovado",
  em_reparo: "Em Reparo",
  aguardando_peca: "Aguardando Peça",
  pronto: "Pronto para Retirada",
  entregue: "Entregue",
};
