import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

export async function exportarDREPDF(params: {
  empresa: { nome: string; cnpj?: string };
  competencia: string;
  dre: any;
  graficosElement: HTMLElement | null;
}) {
  const { empresa, competencia, dre, graficosElement } = params;
  const { atual, anterior, ytd, projecaoAnual, variacao } = dre;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  const [year, monthN] = competencia.split("-").map(Number);
  const nomeMes = new Date(year, monthN - 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  // Cabeçalho
  doc.setFillColor(0, 200, 150);
  doc.rect(0, 0, pageWidth, 12, "F");
  doc.setTextColor(255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(empresa.nome.toUpperCase(), margin, 8);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`CNPJ ${empresa.cnpj || "—"}`, pageWidth - margin, 8, { align: "right" });

  doc.setTextColor(0);
  y = 20;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Demonstrativo de Resultado", margin, y);
  y += 6;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(
    `Competência: ${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}`,
    margin,
    y
  );
  doc.text(
    `Gerado em ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString(
      "pt-BR",
      { hour: "2-digit", minute: "2-digit" }
    )}`,
    pageWidth - margin,
    y,
    { align: "right" }
  );

  // Resumo executivo
  y += 10;
  doc.setFillColor(245, 247, 250);
  doc.rect(margin, y, pageWidth - 2 * margin, 22, "F");
  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMO EXECUTIVO", margin + 3, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const resumo =
    `Receita bruta de ${fmt(atual.receitaBruta)} (${fmtPct(variacao.receitaBruta)} vs mês anterior), ` +
    `EBITDA de ${fmt(atual.ebitda)} (margem ${atual.margemLiquida.toFixed(1)}%), ` +
    `${atual.qtdOSs} OSs entregues. Acumulado YTD: ${fmt(ytd.ebitda)} | Projeção anual: ${fmt(projecaoAnual)}.`;
  const linhas = doc.splitTextToSize(resumo, pageWidth - 2 * margin - 6);
  doc.text(linhas, margin + 3, y + 10);

  // KPIs
  y += 28;
  const cardWidth = (pageWidth - 2 * margin - 9) / 4;
  const cards: Array<{
    label: string;
    valor: string;
    variacao: string;
    cor: [number, number, number];
  }> = [
    {
      label: "Receita Bruta",
      valor: fmt(atual.receitaBruta),
      variacao: fmtPct(variacao.receitaBruta),
      cor: [34, 197, 94],
    },
    {
      label: "EBITDA",
      valor: fmt(atual.ebitda),
      variacao: fmtPct(variacao.ebitda),
      cor: [0, 200, 150],
    },
    {
      label: "Margem Líq.",
      valor: `${atual.margemLiquida.toFixed(1)}%`,
      variacao: `${variacao.margem >= 0 ? "+" : ""}${variacao.margem.toFixed(1)}pp`,
      cor: [99, 102, 241],
    },
    {
      label: "Ticket Médio",
      valor: fmt(atual.ticketMedio),
      variacao: `${atual.qtdOSs} OSs`,
      cor: [251, 146, 60],
    },
  ];
  cards.forEach((card, i) => {
    const x = margin + i * (cardWidth + 3);
    doc.setDrawColor(card.cor[0], card.cor[1], card.cor[2]);
    doc.setLineWidth(0.6);
    doc.line(x, y, x, y + 18);
    doc.setFillColor(252, 252, 252);
    doc.rect(x + 0.6, y, cardWidth - 0.6, 18, "F");
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.setFont("helvetica", "normal");
    doc.text(card.label.toUpperCase(), x + 3, y + 4);
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(card.valor, x + 3, y + 11);
    doc.setFontSize(7);
    doc.setTextColor(card.cor[0], card.cor[1], card.cor[2]);
    doc.setFont("helvetica", "normal");
    doc.text(card.variacao, x + 3, y + 16);
  });

  // Tabela DRE
  y += 24;
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("DRE Detalhada", margin, y);

  const linhasDRE: any[] = [
    { item: "RECEITAS", isHeader: true },
    { item: "Serviços faturados", a: atual.receitaBruta, m: anterior.receitaBruta, ytd: ytd.receitaBruta },
    { item: "(=) Receita Bruta", a: atual.receitaBruta, m: anterior.receitaBruta, ytd: ytd.receitaBruta, bold: true },
    { item: "(-) Impostos", a: -atual.impostos, m: -anterior.impostos, ytd: -ytd.impostos, negativo: true },
    { item: "(=) Receita Líquida", a: atual.receitaLiquida, m: anterior.receitaLiquida, ytd: ytd.receitaLiquida, bold: true },
    { item: "CUSTOS", isHeader: true },
    { item: "(-) Peças utilizadas", a: -atual.custoPecas, m: -anterior.custoPecas, ytd: -ytd.custoPecas, negativo: true },
    { item: "(-) Comissões", a: -atual.comissoes, m: -anterior.comissoes, ytd: -ytd.comissoes, negativo: true },
    { item: "(-) Prejuízos operacionais", a: -atual.prejuizosOperacionais, m: -anterior.prejuizosOperacionais, ytd: -ytd.prejuizosOperacionais, negativo: true },
    { item: "(=) Lucro Bruto", a: atual.lucroBruto, m: anterior.lucroBruto, ytd: ytd.lucroBruto, bold: true },
    { item: "DESPESAS OPERACIONAIS", isHeader: true },
    { item: "(-) Gastos fixos", a: -atual.gastosFixos, m: -anterior.gastosFixos, ytd: -ytd.gastosFixos, negativo: true },
    { item: "(-) Outros gastos", a: -atual.outrosGastos, m: -anterior.outrosGastos, ytd: -ytd.outrosGastos, negativo: true },
    { item: "(=) EBITDA", a: atual.ebitda, m: anterior.ebitda, ytd: ytd.ebitda, bold: true },
    { item: "Margem Líquida (%)", a: atual.margemLiquida, m: anterior.margemLiquida, ytd: ytd.margemLiquida, isPct: true, bold: true },
  ];

  autoTable(doc, {
    startY: y + 2,
    head: [["Item", `${nomeMes}`, "Mês anterior", `YTD ${year}`]],
    body: linhasDRE.map((l) => {
      if (l.isHeader)
        return [
          {
            content: l.item,
            colSpan: 4,
            styles: {
              fillColor: [240, 240, 245],
              textColor: [80, 80, 80],
              fontStyle: "bold",
              fontSize: 8,
            },
          },
        ] as any;
      const valor = (v: number) => (l.isPct ? `${v.toFixed(1)}%` : fmt(v));
      return [
        l.item,
        {
          content: valor(l.a),
          styles: {
            halign: "right",
            textColor: l.negativo ? [200, 40, 40] : [0, 0, 0],
            fontStyle: l.bold ? "bold" : "normal",
          },
        },
        {
          content: valor(l.m),
          styles: {
            halign: "right",
            textColor: l.negativo ? [200, 40, 40] : [80, 80, 80],
          },
        },
        {
          content: valor(l.ytd),
          styles: {
            halign: "right",
            textColor: l.negativo ? [200, 40, 40] : [80, 80, 80],
            fontStyle: l.bold ? "bold" : "normal",
          },
        },
      ] as any;
    }),
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [0, 200, 150], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 35 }, 2: { cellWidth: 35 }, 3: { cellWidth: 35 } },
    margin: { left: margin, right: margin },
  });

  // Projeção anual
  let cursor = (doc as any).lastAutoTable.finalY + 8;
  if (cursor > 260) {
    doc.addPage();
    cursor = 20;
  }
  doc.setFillColor(0, 200, 150);
  doc.rect(margin, cursor, pageWidth - 2 * margin, 14, "F");
  doc.setTextColor(255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("PROJEÇÃO ANUAL", margin + 3, cursor + 5);
  doc.setFontSize(13);
  doc.text(`${fmt(projecaoAnual)} de EBITDA`, margin + 3, cursor + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(
    `Baseado na média dos últimos 3 meses (${fmt(projecaoAnual / 12)} / mês)`,
    pageWidth - margin - 3,
    cursor + 11,
    { align: "right" }
  );

  // Página 2: gráficos
  if (graficosElement) {
    doc.addPage();
    doc.setTextColor(0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Análise Visual", margin, 20);

    const canvas = await html2canvas(graficosElement, { scale: 2, backgroundColor: "#fff" });
    const imgData = canvas.toDataURL("image/png");
    const imgWidth = pageWidth - 2 * margin;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    doc.addImage(imgData, "PNG", margin, 28, imgWidth, Math.min(imgHeight, 240));
  }

  // Rodapé
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.line(margin, 285, pageWidth - margin, 285);
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.setFont("helvetica", "normal");
    doc.text("Documento gerado automaticamente — Ditt Software", margin, 290);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, 290, { align: "right" });
  }

  doc.save(`DRE_${empresa.nome.replace(/\s+/g, "_")}_${competencia}.pdf`);
}
