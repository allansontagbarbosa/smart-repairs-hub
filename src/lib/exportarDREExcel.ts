import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export function exportarDREExcel(params: {
  empresa: { nome: string };
  competencia: string;
  dre: any;
}) {
  const { empresa, competencia, dre } = params;
  const { atual, anterior, ytd, historico, projecaoAnual } = dre;

  const wb = XLSX.utils.book_new();

  const dreData: any[][] = [
    [`DRE - ${empresa.nome}`],
    [`Competência: ${competencia}`],
    [`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`],
    [],
    ["Item", `Mês ${competencia}`, "Mês anterior", "YTD", "Projeção anual"],
    [],
    ["RECEITAS"],
    ["Serviços faturados", atual.receitaBruta, anterior.receitaBruta, ytd.receitaBruta],
    ["(=) Receita Bruta", atual.receitaBruta, anterior.receitaBruta, ytd.receitaBruta],
    ["(-) Impostos", -atual.impostos, -anterior.impostos, -ytd.impostos],
    ["(=) Receita Líquida", atual.receitaLiquida, anterior.receitaLiquida, ytd.receitaLiquida],
    [],
    ["CUSTOS"],
    ["(-) Peças utilizadas", -atual.custoPecas, -anterior.custoPecas, -ytd.custoPecas],
    ["(-) Comissões", -atual.comissoes, -anterior.comissoes, -ytd.comissoes],
    ["(-) Prejuízos operacionais", -atual.prejuizosOperacionais, -anterior.prejuizosOperacionais, -ytd.prejuizosOperacionais],
    ["(=) Lucro Bruto", atual.lucroBruto, anterior.lucroBruto, ytd.lucroBruto],
    [],
    ["DESPESAS OPERACIONAIS"],
    ["(-) Gastos fixos", -atual.gastosFixos, -anterior.gastosFixos, -ytd.gastosFixos],
    ["(-) Outros gastos", -atual.outrosGastos, -anterior.outrosGastos, -ytd.outrosGastos],
    ["(=) EBITDA", atual.ebitda, anterior.ebitda, ytd.ebitda, projecaoAnual],
    [],
    ["Margem Líquida (%)", atual.margemLiquida / 100, anterior.margemLiquida / 100, ytd.margemLiquida / 100],
    ["Qtd OSs", atual.qtdOSs, anterior.qtdOSs, ytd.qtdOSs],
    ["Ticket médio", atual.ticketMedio, anterior.ticketMedio, ytd.ticketMedio],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(dreData);
  ws1["!cols"] = [{ wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws1, "DRE");

  const historicoData: any[][] = [
    ["Competência", "Receita", "Custos", "Lucro Bruto", "Despesas", "EBITDA", "Margem %", "OSs"],
    ...historico.map((h: any) => [
      h.competencia,
      h.receitaBruta,
      h.custoPecas + h.comissoes + h.prejuizosOperacionais,
      h.lucroBruto,
      h.gastosFixos + h.outrosGastos,
      h.ebitda,
      h.margemLiquida / 100,
      h.qtdOSs,
    ]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(historicoData);
  ws2["!cols"] = [{ wch: 12 }, ...Array(7).fill({ wch: 15 })];
  XLSX.utils.book_append_sheet(wb, ws2, "Histórico 12 meses");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(
    new Blob([wbout], { type: "application/octet-stream" }),
    `DRE_${empresa.nome.replace(/\s+/g, "_")}_${competencia}.xlsx`
  );
}
