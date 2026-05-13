interface DREData {
  servicosFaturados: number;
  outrosReceb: number;
  receitaBruta: number;
  impostos: number;
  receitaLiquida: number;
  custoPecas: number;
  comissoesPagas: number;
  prejuizosOpTotal: number;
  lucroBruto: number;
  gastosFixos: number;
  outrosGastos: number;
  depreciacao: number;
  ebitda: number;
  prejuizosNaoOpTotal: number;
  resultadoNaoOperacional: number;
}

interface ImprimirDREParams {
  empresa: { nome: string; cnpj?: string };
  competencia: string; // YYYY-MM
  dre: DREData;
  graficosHTML?: string;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

type Linha =
  | { tipo: "header"; label: string }
  | {
      tipo?: "linha";
      label: string;
      valor: number;
      bold?: boolean;
      total?: boolean;
      destaque?: boolean;
      negativo?: boolean;
    };

export function imprimirDRE(params: ImprimirDREParams) {
  const { empresa, competencia, dre, graficosHTML } = params;
  const [year, monthN] = competencia.split("-").map(Number);
  const nomeMes = new Date(year, monthN - 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const nomeMesCapital = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

  const margem = dre.receitaBruta > 0 ? (dre.ebitda / dre.receitaBruta) * 100 : 0;
  const lucroLiquido = dre.ebitda - dre.depreciacao;

  const linhas: Linha[] = [
    { tipo: "header", label: "RECEITAS" },
    { label: "Serviços faturados", valor: dre.servicosFaturados },
    ...(dre.outrosReceb > 0
      ? [{ label: "Outros recebimentos", valor: dre.outrosReceb } as Linha]
      : []),
    { label: "= Receita Bruta", valor: dre.receitaBruta, bold: true, total: true },
    { tipo: "header", label: "DEDUÇÕES" },
    { label: "(−) Impostos", valor: -dre.impostos, negativo: true },
    { label: "= Receita Líquida", valor: dre.receitaLiquida, bold: true, total: true },
    { tipo: "header", label: "CUSTOS" },
    { label: "(−) Peças utilizadas", valor: -dre.custoPecas, negativo: true },
    { label: "(−) Comissões", valor: -dre.comissoesPagas, negativo: true },
    ...(dre.prejuizosOpTotal > 0
      ? [
          {
            label: "(−) Prejuízos operacionais",
            valor: -dre.prejuizosOpTotal,
            negativo: true,
          } as Linha,
        ]
      : []),
    { label: "= Lucro Bruto", valor: dre.lucroBruto, bold: true, total: true, destaque: true },
    { tipo: "header", label: "DESPESAS OPERACIONAIS" },
    { label: "(−) Gastos fixos", valor: -dre.gastosFixos, negativo: true },
    { label: "(−) Outros gastos", valor: -dre.outrosGastos, negativo: true },
    { label: "= EBITDA", valor: dre.ebitda, bold: true, total: true, destaque: true },
    { tipo: "header", label: "RESULTADO" },
    ...(dre.depreciacao > 0
      ? [
          {
            label: "(−) Depreciação estimada",
            valor: -dre.depreciacao,
            negativo: true,
          } as Linha,
        ]
      : []),
    { label: "= Lucro Líquido", valor: lucroLiquido, bold: true, total: true, destaque: true },
    ...(dre.prejuizosNaoOpTotal > 0
      ? [
          {
            label: "(−) Prejuízos não-operacionais",
            valor: -dre.prejuizosNaoOpTotal,
            negativo: true,
          } as Linha,
        ]
      : []),
  ];

  const linhasHTML = linhas
    .map((l) => {
      if (l.tipo === "header") {
        return `<tr><td colspan="2" class="header-row">${l.label}</td></tr>`;
      }
      const classes = [
        l.bold && "bold",
        l.total && "total",
        l.destaque && "destaque",
        l.negativo && "negativo",
      ]
        .filter(Boolean)
        .join(" ");
      return `<tr class="${classes}"><td>${l.label}</td><td class="valor">${fmt(l.valor)}</td></tr>`;
    })
    .join("");

  const dataGer = new Date().toLocaleDateString("pt-BR");
  const horaGer = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>DRE ${nomeMesCapital} — ${empresa.nome}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Manrope", "Inter", sans-serif;
    font-size: 11pt; line-height: 1.5; color: #1a1a1a; background: #f5f5f5;
  }
  .page {
    max-width: 210mm; min-height: 297mm; margin: 10mm auto;
    padding: 0 0 15mm 0; background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  .header {
    background: #00C896; color: white; padding: 12mm 15mm;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .header h1 { font-size: 20pt; font-weight: 700; letter-spacing: -0.5pt; line-height: 1.1; }
  .header .empresa-info { text-align: right; font-size: 9pt; line-height: 1.4; opacity: 0.95; }
  .content { padding: 8mm 15mm 0 15mm; }
  .titulo-secao { margin: 0 0 6mm 0; }
  .titulo-secao h2 { font-size: 18pt; font-weight: 700; color: #1a1a1a; letter-spacing: -0.3pt; }
  .titulo-secao .subtitulo { font-size: 10pt; color: #666; margin-top: 1mm; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin: 6mm 0; }
  .kpi-card {
    border-left: 1mm solid #00C896; background: #f8f9fa;
    padding: 4mm; page-break-inside: avoid;
  }
  .kpi-card.green  { border-color: #22c55e; }
  .kpi-card.blue   { border-color: #3b82f6; }
  .kpi-card.purple { border-color: #8b5cf6; }
  .kpi-card.orange { border-color: #f59e0b; }
  .kpi-card .label {
    font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.6pt;
    color: #666; font-weight: 600;
  }
  .kpi-card .valor { font-size: 14pt; font-weight: 700; margin-top: 2mm; color: #1a1a1a; line-height: 1.2; }
  .kpi-card .sub { font-size: 8pt; color: #666; margin-top: 1mm; }
  .dre-table { width: 100%; border-collapse: collapse; margin: 4mm 0; font-size: 10pt; }
  .dre-table .header-row td {
    background: #f0f0f3; color: #444; font-size: 7.5pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.8pt;
    padding: 3mm 3mm 2mm 3mm; border-bottom: 0.3mm solid #d4d4d8;
  }
  .dre-table td { padding: 2.5mm 3mm; border-bottom: 0.1mm solid #f0f0f0; }
  .dre-table td.valor { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .dre-table tr.bold td { font-weight: 700; }
  .dre-table tr.total td {
    border-top: 0.3mm solid #000; border-bottom: 0.3mm solid #000;
    padding-top: 3mm; padding-bottom: 3mm;
  }
  .dre-table tr.destaque td { background: #f0fdf4; }
  .dre-table tr.negativo td.valor { color: #dc2626; }
  .graficos-secao {
    margin-top: 10mm; page-break-before: always; padding-top: 8mm;
  }
  .graficos-secao h2 { font-size: 16pt; font-weight: 700; margin-bottom: 6mm; color: #1a1a1a; }
  .graficos-container svg { max-width: 100%; height: auto; }
  .rodape {
    margin: 10mm 15mm 0 15mm; padding-top: 4mm; border-top: 0.2mm solid #ddd;
    font-size: 8pt; color: #888; display: flex; justify-content: space-between;
  }
  @page { size: A4; margin: 0; }
  @media print {
    body { background: white; margin: 0; }
    .page { margin: 0; box-shadow: none; }
    .no-print { display: none !important; }
  }
  .controls {
    position: fixed; top: 1rem; right: 1rem; background: white;
    padding: 8px 12px; border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.18);
    z-index: 9999; display: flex; gap: 8px;
  }
  .controls button {
    padding: 8px 16px; border: none; border-radius: 6px;
    font-weight: 600; cursor: pointer; font-size: 11pt;
  }
  .controls button:hover { opacity: 0.85; }
  .btn-print { background: #00C896; color: white; }
  .btn-close { background: #f0f0f0; color: #333; }
</style>
</head>
<body>
  <div class="controls no-print">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
    <button class="btn-close" onclick="window.close()">Fechar</button>
  </div>
  <div class="page">
    <div class="header">
      <div>
        <h1>${empresa.nome.toUpperCase()}</h1>
      </div>
      <div class="empresa-info">
        ${empresa.cnpj ? `CNPJ ${empresa.cnpj}<br>` : ""}
        Gerado em ${dataGer} às ${horaGer}
      </div>
    </div>
    <div class="content">
      <div class="titulo-secao">
        <h2>Demonstrativo de Resultado</h2>
        <div class="subtitulo">Competência: ${nomeMesCapital}</div>
      </div>
      <div class="kpis">
        <div class="kpi-card green">
          <div class="label">Receita Bruta</div>
          <div class="valor">${fmt(dre.receitaBruta)}</div>
          <div class="sub">Total faturado no mês</div>
        </div>
        <div class="kpi-card blue">
          <div class="label">Lucro Bruto</div>
          <div class="valor">${fmt(dre.lucroBruto)}</div>
          <div class="sub">Receita menos custos</div>
        </div>
        <div class="kpi-card purple">
          <div class="label">EBITDA</div>
          <div class="valor">${fmt(dre.ebitda)}</div>
          <div class="sub">Resultado operacional</div>
        </div>
        <div class="kpi-card orange">
          <div class="label">Margem Líquida</div>
          <div class="valor">${fmtPct(margem)}</div>
          <div class="sub">EBITDA / Receita Bruta</div>
        </div>
      </div>
      <table class="dre-table">
        <tbody>${linhasHTML}</tbody>
      </table>
      ${
        graficosHTML
          ? `<div class="graficos-secao">
              <h2>Análise Visual</h2>
              <div class="graficos-container">${graficosHTML}</div>
            </div>`
          : ""
      }
    </div>
    <div class="rodape">
      <span>${empresa.nome} — DRE ${nomeMesCapital}</span>
      <span>Documento gerado automaticamente pelo Ditt Software</span>
    </div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) {
    alert("Por favor, permita pop-ups deste site para gerar o relatório.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
