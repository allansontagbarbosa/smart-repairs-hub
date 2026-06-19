import {
  getStatusCategoria,
  type StatusCatalogoRow,
} from "@/components/atacado/AtacadoStatusBadge";

export type LocalInventario = "em_estoque" | "em_transito" | "em_assistencia";

export type LocalKpi = {
  unidades: number;
  custo: number;
  venda: number;
  lucro: number;
};

export type InventarioKpis = {
  unidades: number;
  custoTotal: number;
  vendaTotal: number;
  lucroPotencial: number;
  lucroMedioPorAparelho: number;
  markupMedioPct: number;
  margemMediaPct: number;
  porLocal: Record<LocalInventario, LocalKpi>;
  totalAparelhosNaoVendidos: number;
};

const LOCAIS: LocalInventario[] = ["em_estoque", "em_transito", "em_assistencia"];

function emptyLocal(): LocalKpi {
  return { unidades: 0, custo: 0, venda: 0, lucro: 0 };
}

/**
 * Calcula KPIs do inventário inteiro (estoque + transporte + assistência),
 * de forma case-insensitive via categoria do status.
 * "Vendido" é excluído.
 */
export function computeInventarioKpis(
  aparelhos: any[],
  statusCatalogo: StatusCatalogoRow[],
): InventarioKpis {
  const porLocal: Record<LocalInventario, LocalKpi> = {
    em_estoque: emptyLocal(),
    em_transito: emptyLocal(),
    em_assistencia: emptyLocal(),
  };

  let unidades = 0;
  let custoTotal = 0;
  let vendaTotal = 0;
  let somaMarkupPond = 0;
  let somaMargemPond = 0;
  let unidadesParaMedia = 0;
  let totalAparelhosNaoVendidos = 0;

  for (const a of aparelhos ?? []) {
    const cat = getStatusCategoria(a?.status, statusCatalogo) as LocalInventario | string;
    if (cat === "vendido") continue;
    // Tudo que não é vendido conta no inventário; reservado/outro contam como "em_estoque" para totais
    const localKey: LocalInventario = LOCAIS.includes(cat as LocalInventario)
      ? (cat as LocalInventario)
      : "em_estoque";

    const qtd = Number(a?.quantidade ?? 0) || 0;
    const custoUnit = Number(a?.custo ?? 0) || 0;
    const precoUnit = Number(a?.preco_sugerido ?? 0) || 0;
    const venda = precoUnit > 0 ? precoUnit * qtd : custoUnit * qtd;
    const custo = custoUnit * qtd;
    const lucro = venda - custo;

    porLocal[localKey].unidades += qtd;
    porLocal[localKey].custo += custo;
    porLocal[localKey].venda += venda;
    porLocal[localKey].lucro += lucro;

    unidades += qtd;
    custoTotal += custo;
    vendaTotal += venda;
    totalAparelhosNaoVendidos += 1;

    if (custoUnit > 0 && precoUnit > 0 && qtd > 0) {
      const markup = (precoUnit - custoUnit) / custoUnit;
      const margem = (precoUnit - custoUnit) / precoUnit;
      somaMarkupPond += markup * qtd;
      somaMargemPond += margem * qtd;
      unidadesParaMedia += qtd;
    }
  }

  const lucroPotencial = vendaTotal - custoTotal;
  const lucroMedioPorAparelho =
    totalAparelhosNaoVendidos > 0 ? lucroPotencial / totalAparelhosNaoVendidos : 0;
  const markupMedioPct =
    unidadesParaMedia > 0 ? (somaMarkupPond / unidadesParaMedia) * 100 : 0;
  const margemMediaPct =
    unidadesParaMedia > 0 ? (somaMargemPond / unidadesParaMedia) * 100 : 0;

  return {
    unidades,
    custoTotal,
    vendaTotal,
    lucroPotencial,
    lucroMedioPorAparelho,
    markupMedioPct,
    margemMediaPct,
    porLocal,
    totalAparelhosNaoVendidos,
  };
}
