export type PagamentoLinha = {
  status: string;
  vencimento?: string | null;
  valor_pago?: number | null;
};

export type StatusPagamentoPedido = "pago" | "parcial" | "aguardando" | "atrasado" | "sem_pagamentos";

export function calcularStatusPagamento(pagamentos: PagamentoLinha[] | null | undefined): StatusPagamentoPedido {
  if (!pagamentos || pagamentos.length === 0) return "sem_pagamentos";
  const ativas = pagamentos.filter((p) => p.status !== "cancelado");
  if (ativas.length === 0) return "sem_pagamentos";
  const pagas = ativas.filter((p) => p.status === "pago").length;
  const temParcial = ativas.some(
    (p) => p.status === "parcial" || (Number(p.valor_pago ?? 0) > 0 && p.status !== "pago"),
  );
  const hoje = new Date().toISOString().slice(0, 10);
  const temAtrasada = ativas.some(
    (p) => p.status !== "pago" && p.status !== "parcial" && p.vencimento && p.vencimento < hoje,
  );
  if (pagas === ativas.length) return "pago";
  if (temParcial) return "parcial";
  if (temAtrasada) return "atrasado";
  if (pagas > 0) return "parcial";
  return "aguardando";
}

export function labelStatusPagamento(s: StatusPagamentoPedido): string {
  switch (s) {
    case "pago": return "Pago";
    case "parcial": return "Parcial";
    case "atrasado": return "Atrasado";
    case "aguardando": return "Aguardando pagamento";
    default: return "Sem pagamentos";
  }
}

export function classesStatusPagamento(s: StatusPagamentoPedido): string {
  switch (s) {
    case "pago": return "bg-success/15 text-success border-success/30";
    case "parcial": return "bg-info/15 text-info border-info/30";
    case "atrasado": return "bg-destructive/15 text-destructive border-destructive/30";
    case "aguardando": return "bg-warning/15 text-warning border-warning/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}
