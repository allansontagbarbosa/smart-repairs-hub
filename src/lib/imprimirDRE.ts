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
  lucroLiquido?: number;
  reservaPct?: number;
  reserva?: number;
  partesSocios?: { id: string; nome: string; percentual: number; valor: number }[];
}

interface ImprimirDREParams {
  empresa: { nome: string; cnpj?: string };
  competencia: string; // YYYY-MM
  dre: DREData;
  socios?: { id: string; nome: string }[];
  graficosHTML?: string;
}

const n = (v: unknown) => Number(v ?? 0) || 0;
const fmt = (v?: number | null) =>
  n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v?: number | null) => `${n(v).toFixed(1)}%`;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Insere espaços em "ARJASSISTENCIALTDA" → "ARJ ASSISTENCIA LTDA"
// Estratégia: separa por dicionário comum de termos societários; se vier vazio
// ou já com espaços, mantém. Sem alterar nomes que já estejam OK.
function formatarNomeEmpresa(raw: string): string {
  if (!raw) return "EMPRESA";
  const upper = raw.toUpperCase().trim();
  // Já tem espaços? só normaliza
  if (/\s/.test(upper)) return upper.replace(/\s+/g, " ");
  // Tenta separar sufixos comuns
  const sufixos = ["LTDA", "ME", "EIRELI", "EPP", "SA", "MEI"];
  let s = upper;
  sufixos.forEach((suf) => {
    const re = new RegExp(`${suf}$`);
    if (re.test(s)) s = s.replace(re, ` ${suf}`);
  });
  // Tenta separar palavras conhecidas no meio
  const palavras = ["ASSISTENCIA", "ASSISTÊNCIA", "TECNICA", "TÉCNICA", "COMERCIO", "COMÉRCIO", "SERVICOS", "SERVIÇOS", "TECNOLOGIA", "MOBILE", "FIX"];
  palavras.forEach((p) => {
    const re = new RegExp(p, "g");
    s = s.replace(re, ` ${p} `);
  });
  return s.replace(/\s+/g, " ").trim();
}

type Linha =
  | { tipo: "header"; label: string }
  | {
      label: string;
      valor: number;
      bold?: boolean;
      total?: boolean;
      destaque?: boolean;
      negativo?: boolean;
      distribuicao?: boolean;
    };

export function imprimirDRE(params: ImprimirDREParams) {
  const { empresa, competencia, dre: rawDre, socios = [], graficosHTML } = params;
  // Normaliza todos os campos numéricos pra 0 quando vierem undefined/null
  const dre = {
    servicosFaturados: n(rawDre.servicosFaturados),
    outrosReceb: n(rawDre.outrosReceb),
    receitaBruta: n(rawDre.receitaBruta),
    impostos: n(rawDre.impostos),
    receitaLiquida: n(rawDre.receitaLiquida),
    custoPecas: n(rawDre.custoPecas),
    comissoesPagas: n(rawDre.comissoesPagas),
    prejuizosOpTotal: n(rawDre.prejuizosOpTotal),
    lucroBruto: n(rawDre.lucroBruto),
    gastosFixos: n(rawDre.gastosFixos),
    outrosGastos: n(rawDre.outrosGastos),
    depreciacao: n(rawDre.depreciacao),
    ebitda: n(rawDre.ebitda),
    prejuizosNaoOpTotal: n(rawDre.prejuizosNaoOpTotal),
    resultadoNaoOperacional: n(rawDre.resultadoNaoOperacional),
    lucroLiquido: rawDre.lucroLiquido != null ? n(rawDre.lucroLiquido) : undefined,
    reservaPct: rawDre.reservaPct,
    reserva: rawDre.reserva != null ? n(rawDre.reserva) : undefined,
    partesSocios: rawDre.partesSocios,
  };
  const [year, monthN] = competencia.split("-").map(Number);
  const nomeMes = new Date(year, monthN - 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const nomeMesCapital = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

  const margem =
    dre.receitaBruta > 0 ? (dre.ebitda / dre.receitaBruta) * 100 : 0;
  const lucroLiquido = dre.lucroLiquido ?? dre.ebitda - dre.depreciacao;

  const linhas: Linha[] = [
    { tipo: "header", label: "RECEITAS" },
    { label: "Serviços faturados", valor: dre.servicosFaturados },
    ...(dre.outrosReceb > 0
      ? [{ label: "Outros recebimentos", valor: dre.outrosReceb }]
      : []),
    { label: "= Receita Bruta", valor: dre.receitaBruta, bold: true, total: true },
    { tipo: "header", label: "DEDUÇÕES" },
    { label: "(−) Impostos", valor: -dre.impostos, negativo: true },
    { label: "= Receita Líquida", valor: dre.receitaLiquida, bold: true, total: true },
    { tipo: "header", label: "CUSTOS" },
    { label: "(−) Peças utilizadas", valor: -dre.custoPecas, negativo: true },
    { label: "(−) Comissões", valor: -dre.comissoesPagas, negativo: true },
    ...(dre.prejuizosOpTotal > 0
      ? [{ label: "(−) Prejuízos operacionais", valor: -dre.prejuizosOpTotal, negativo: true }]
      : []),
    { label: "= Lucro Bruto", valor: dre.lucroBruto, bold: true, total: true, destaque: true },
    { tipo: "header", label: "DESPESAS OPERACIONAIS" },
    { label: "(−) Gastos fixos", valor: -dre.gastosFixos, negativo: true },
    { label: "(−) Outros gastos", valor: -dre.outrosGastos, negativo: true },
    { label: "= EBITDA", valor: dre.ebitda, bold: true, total: true, destaque: true },
    { tipo: "header", label: "RESULTADO" },
    ...(dre.depreciacao > 0
      ? [{ label: "(−) Depreciação estimada", valor: -dre.depreciacao, negativo: true }]
      : []),
    { label: "= Lucro Líquido", valor: lucroLiquido, bold: true, total: true, destaque: true },
  ];

  const partesSocios = dre.partesSocios ?? [];
  if (lucroLiquido > 0 && partesSocios.length > 0 && dre.reservaPct !== undefined) {
    linhas.push({ tipo: "header", label: "DISTRIBUIÇÃO" });
    linhas.push({
      label: `Reserva empresa (${dre.reservaPct}%)`,
      valor: dre.reserva ?? 0,
      distribuicao: true,
    });
    partesSocios.forEach((p) => {
      linhas.push({
        label: `${p.nome} (${n(p.percentual).toFixed(2)}%)`,
        valor: n(p.valor),
        distribuicao: true,
      });
    });
  }

  const linhasHTML = linhas
    .map((l) => {
      if ("tipo" in l && l.tipo === "header") {
        return `<tr class="section-header"><td colspan="2">${escapeHtml(l.label)}</td></tr>`;
      }
      const li = l as Exclude<Linha, { tipo: "header" }>;
      const classes = [
        li.bold && "bold",
        li.total && "total",
        li.destaque && "destaque",
        li.negativo && "negativo",
        li.distribuicao && "distribuicao",
      ]
        .filter(Boolean)
        .join(" ");
      return `<tr class="${classes}"><td>${escapeHtml(li.label)}</td><td class="val">${fmt(li.valor)}</td></tr>`;
    })
    .join("");

  // ===== Pizza =====
  const pizzaData = [
    { nome: "Peças", valor: dre.custoPecas, cor: "#00C896" },
    { nome: "Comissões", valor: dre.comissoesPagas, cor: "#3b82f6" },
    { nome: "Gastos fixos", valor: dre.gastosFixos, cor: "#f59e0b" },
    { nome: "Outros gastos", valor: dre.outrosGastos, cor: "#ef4444" },
    ...(dre.prejuizosOpTotal > 0
      ? [{ nome: "Prejuízos", valor: dre.prejuizosOpTotal, cor: "#8b5cf6" }]
      : []),
  ].filter((d) => d.valor > 0);

  const totalPizza = pizzaData.reduce((s, d) => s + d.valor, 0);

  let pizzaSVG = "";
  if (totalPizza > 0) {
    const cx = 110, cy = 110, r = 90;
    let acum = -Math.PI / 2;
    const fatias = pizzaData.map((d) => {
      const pct = d.valor / totalPizza;
      const ang = pct * 2 * Math.PI;
      const x1 = cx + r * Math.cos(acum);
      const y1 = cy + r * Math.sin(acum);
      const fim = acum + ang;
      const x2 = cx + r * Math.cos(fim);
      const y2 = cy + r * Math.sin(fim);
      const large = ang > Math.PI ? 1 : 0;
      // Caso de uma única fatia (100%), desenha círculo
      const path =
        pct >= 0.999
          ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`
          : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      acum = fim;
      return { path, ...d, pct: pct * 100 };
    });
    pizzaSVG = `
      <div class="pizza-wrap">
        <svg viewBox="0 0 220 220" width="240" height="240" xmlns="http://www.w3.org/2000/svg">
          ${fatias
            .map(
              (f) => `<path d="${f.path}" fill="${f.cor}" stroke="#fff" stroke-width="2"/>`
            )
            .join("")}
        </svg>
        <ul class="pizza-legend">
          ${fatias
            .map(
              (f) => `
            <li>
              <span class="dot" style="background:${f.cor}"></span>
              <span class="lname">${escapeHtml(f.nome)}</span>
              <span class="lval">${fmt(f.valor)} <em>(${f.pct.toFixed(1)}%)</em></span>
            </li>`
            )
            .join("")}
        </ul>
      </div>`;
  }

  const nomeEmpresa = escapeHtml(formatarNomeEmpresa(empresa.nome));
  const cnpjLine = empresa.cnpj
    ? `<div class="meta">CNPJ ${escapeHtml(empresa.cnpj)}</div>`
    : "";
  const dataGerada = `${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString(
    "pt-BR",
    { hour: "2-digit", minute: "2-digit" }
  )}`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>DRE — ${nomeEmpresa} — ${nomeMesCapital}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #111827;
    margin: 0;
    background: #f3f4f6;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    background: #fff;
    max-width: 210mm;
    margin: 16px auto;
    padding: 24px 28px;
    box-shadow: 0 4px 24px rgba(0,0,0,.08);
  }
  .header {
    background: linear-gradient(135deg, #00C896 0%, #00a37a 100%);
    color: #fff;
    padding: 22px 26px;
    border-radius: 12px;
    margin-bottom: 22px;
  }
  .header h1 {
    margin: 0 0 6px;
    font-size: 22pt;
    letter-spacing: 2px;
    font-weight: 800;
  }
  .header .meta { font-size: 10pt; opacity: .92; line-height: 1.5; }

  h2.title { margin: 0 0 4px; font-size: 16pt; }
  .subtitle { color: #6b7280; margin: 0 0 18px; font-size: 11pt; }

  .kpis {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 22px;
  }
  .kpi {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 12px 14px;
    background: #fafafa;
  }
  .kpi .l { font-size: 8.5pt; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; }
  .kpi .v { font-size: 14pt; font-weight: 700; margin-top: 4px; color: #111827; }
  .kpi .h { font-size: 8pt; color: #9ca3af; margin-top: 2px; }

  table.dre {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5pt;
  }
  table.dre td {
    padding: 6px 10px;
    border-bottom: 1px solid #f3f4f6;
  }
  table.dre td.val { text-align: right; font-variant-numeric: tabular-nums; }
  table.dre tr.section-header td {
    background: #f9fafb;
    color: #6b7280;
    font-weight: 700;
    font-size: 9pt;
    letter-spacing: 1px;
    padding: 10px;
    border-bottom: 1px solid #e5e7eb;
    border-top: 1px solid #e5e7eb;
  }
  table.dre tr.bold td { font-weight: 700; }
  table.dre tr.total td { background: #f9fafb; }
  table.dre tr.destaque td { background: #ecfdf5; color: #065f46; }
  table.dre tr.negativo td.val { color: #b91c1c; }
  table.dre tr.distribuicao td {
    background: #fffbeb;
    color: #92400e;
    font-weight: 600;
  }

  .charts-section { margin-top: 26px; page-break-before: always; }
  .charts-section h3 { margin: 0 0 4px; font-size: 14pt; }
  .charts-section p.sub { margin: 0 0 14px; color: #6b7280; font-size: 10pt; }

  .pizza-wrap {
    display: flex;
    align-items: center;
    gap: 24px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 18px;
  }
  .pizza-legend { list-style: none; padding: 0; margin: 0; flex: 1; }
  .pizza-legend li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    font-size: 10.5pt;
    border-bottom: 1px dashed #e5e7eb;
  }
  .pizza-legend li:last-child { border-bottom: none; }
  .pizza-legend .dot { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
  .pizza-legend .lname { flex: 1; font-weight: 600; }
  .pizza-legend .lval { font-variant-numeric: tabular-nums; color: #374151; }
  .pizza-legend em { color: #6b7280; font-style: normal; }

  .charts-extra {
    margin-top: 22px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 16px;
    background: #fff;
  }
  .charts-extra h4 { margin: 0 0 10px; font-size: 12pt; }

  .footer {
    margin-top: 22px;
    padding-top: 14px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    color: #9ca3af;
    font-size: 9pt;
  }

  .controls {
    position: fixed;
    top: 12px; right: 12px;
    background: #fff;
    padding: 8px;
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0,0,0,.18);
    z-index: 9999;
    display: flex; gap: 6px;
  }
  .controls button {
    padding: 8px 14px; border: none; border-radius: 6px;
    font-weight: 600; cursor: pointer; font-size: 10pt;
  }
  .btn-print { background: #00C896; color: #fff; }
  .btn-close { background: #f3f4f6; color: #374151; }

  @media print {
    body { background: #fff; }
    .page { margin: 0; box-shadow: none; padding: 0; max-width: none; }
    .controls { display: none !important; }
  }
</style>
</head>
<body>
  <div class="controls">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
    <button class="btn-close" onclick="window.close()">Fechar</button>
  </div>

  <div class="page">
    <div class="header">
      <h1>${nomeEmpresa}</h1>
      ${cnpjLine}
      <div class="meta">Gerado em ${dataGerada}</div>
    </div>

    <h2 class="title">Demonstrativo de Resultado</h2>
    <p class="subtitle">Competência: ${nomeMesCapital}</p>

    <div class="kpis">
      <div class="kpi"><div class="l">Receita Bruta</div><div class="v">${fmt(dre.receitaBruta)}</div><div class="h">Total faturado</div></div>
      <div class="kpi"><div class="l">Lucro Bruto</div><div class="v">${fmt(dre.lucroBruto)}</div><div class="h">Receita − custos</div></div>
      <div class="kpi"><div class="l">EBITDA</div><div class="v">${fmt(dre.ebitda)}</div><div class="h">Resultado operacional</div></div>
      <div class="kpi"><div class="l">Margem</div><div class="v">${fmtPct(margem)}</div><div class="h">EBITDA / Receita</div></div>
    </div>

    <table class="dre"><tbody>${linhasHTML}</tbody></table>

    <div class="charts-section">
      <h3>Análise Visual</h3>
      <p class="sub">Distribuição de custos e despesas operacionais</p>
      ${pizzaSVG || '<p style="color:#9ca3af">Sem dados de custos para o período.</p>'}
      ${
        graficosHTML
          ? `<div class="charts-extra"><h4>Últimos 6 meses</h4>${graficosHTML}</div>`
          : ""
      }
    </div>

    <div class="footer">
      <span>${nomeEmpresa} — DRE ${nomeMesCapital}</span>
      <span>Documento gerado pelo Ditt Software</span>
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
