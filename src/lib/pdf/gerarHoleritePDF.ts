import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type HoleriteEvento = {
  id: string;
  tipo: "provento" | "desconto";
  codigo: string;
  descricao: string;
  referencia?: string | null;
  valor_centavos: number;
  ordem?: number;
  origem?: string | null;
};

export type HoleriteFuncionario = {
  id: string;
  nome: string;
  cargo?: string | null;
  tipo_vinculo?: string | null;
  cpf?: string | null;
  data_admissao?: string | null;
};

export type HoleriteEmpresa = {
  nome?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
};

export type HoleritePDFPayload = {
  empresa: HoleriteEmpresa;
  funcionario: HoleriteFuncionario;
  competencia: string; // YYYY-MM
  eventos: HoleriteEvento[];
  total_proventos_centavos: number;
  total_descontos_centavos: number;
  liquido_centavos: number;
  horas_trabalhadas?: number;
  dias_trabalhados?: number;
  faltas?: number;
};

const fmt = (c: number) =>
  (Number(c ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtCompetencia = (ym: string) => {
  const [y, m] = ym.split("-");
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${meses[parseInt(m, 10) - 1]}/${y}`;
};

const fmtData = (s?: string | null) =>
  s ? new Date(s.includes("T") ? s : `${s}T00:00:00`).toLocaleDateString("pt-BR") : "—";

const sanitizeFile = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_") || "funcionario";

export function nomeArquivoHolerite(p: Pick<HoleritePDFPayload, "funcionario" | "competencia">) {
  return `holerite_${sanitizeFile(p.funcionario.nome)}_${p.competencia}.pdf`;
}

export function adicionarHoleritePDF(doc: jsPDF, p: HoleritePDFPayload, startY = 40): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  const contentW = pageWidth - margin * 2;
  let y = startY;

  // Cabeçalho empresa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(p.empresa.nome || "Empresa", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const empresaLinha = [
    p.empresa.cnpj ? `CNPJ: ${p.empresa.cnpj}` : null,
    p.empresa.telefone,
    p.empresa.email,
    [p.empresa.endereco, p.empresa.cidade, p.empresa.estado].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("  •  ");
  if (empresaLinha) doc.text(empresaLinha, margin, y + 14, { maxWidth: contentW });

  y += 28;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);

  // Título
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`RECIBO DE PAGAMENTO — ${fmtCompetencia(p.competencia)}`, margin, y);

  // Dados funcionário
  y += 16;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Funcionário: ${p.funcionario.nome}`, margin, y);
  if (p.funcionario.cargo) doc.text(`Cargo: ${p.funcionario.cargo}`, margin + 260, y);
  y += 12;
  doc.text(`CPF: ${p.funcionario.cpf || "—"}`, margin, y);
  doc.text(`Vínculo: ${(p.funcionario.tipo_vinculo || "—").toUpperCase()}`, margin + 180, y);
  doc.text(`Admissão: ${fmtData(p.funcionario.data_admissao)}`, margin + 320, y);

  y += 14;

  const proventos = p.eventos.filter((e) => e.tipo === "provento");
  const descontos = p.eventos.filter((e) => e.tipo === "desconto");
  const maxLen = Math.max(proventos.length, descontos.length, 1);

  const rows: any[][] = [];
  for (let i = 0; i < maxLen; i++) {
    const pr = proventos[i];
    const de = descontos[i];
    rows.push([
      pr ? pr.descricao : "",
      pr?.referencia || "",
      pr ? fmt(pr.valor_centavos) : "",
      de ? de.descricao : "",
      de?.referencia || "",
      de ? fmt(de.valor_centavos) : "",
    ]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    theme: "grid",
    head: [
      [
        { content: "PROVENTOS", colSpan: 3, styles: { halign: "center", fillColor: [16, 122, 87], textColor: [255, 255, 255] } },
        { content: "DESCONTOS", colSpan: 3, styles: { halign: "center", fillColor: [185, 28, 28], textColor: [255, 255, 255] } },
      ],
      ["Descrição", "Ref.", "Valor", "Descrição", "Ref.", "Valor"],
    ],
    body: rows,
    styles: { fontSize: 8.5, cellPadding: 4 },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: contentW * 0.27 },
      1: { cellWidth: contentW * 0.1, halign: "center" },
      2: { cellWidth: contentW * 0.13, halign: "right" },
      3: { cellWidth: contentW * 0.27 },
      4: { cellWidth: contentW * 0.1, halign: "center" },
      5: { cellWidth: contentW * 0.13, halign: "right" },
    },
    foot: [
      [
        { content: "TOTAL PROVENTOS", colSpan: 2, styles: { halign: "right", fontStyle: "bold" } },
        { content: fmt(p.total_proventos_centavos), styles: { halign: "right", fontStyle: "bold" } },
        { content: "TOTAL DESCONTOS", colSpan: 2, styles: { halign: "right", fontStyle: "bold" } },
        { content: fmt(p.total_descontos_centavos), styles: { halign: "right", fontStyle: "bold", textColor: [185, 28, 28] } },
      ],
    ],
    footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42] },
  });

  let finalY = (doc as any).lastAutoTable?.finalY ?? y;
  finalY += 14;

  // Líquido em destaque
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, finalY, contentW, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("VALOR LÍQUIDO A RECEBER", margin + 12, finalY + 20);
  doc.setFontSize(14);
  doc.text(fmt(p.liquido_centavos), pageWidth - margin - 12, finalY + 21, { align: "right" });
  doc.setTextColor(0, 0, 0);

  finalY += 44;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(
    `Horas trabalhadas: ${Number(p.horas_trabalhadas ?? 0).toFixed(1)}h   •   Dias trabalhados: ${p.dias_trabalhados ?? 0}   •   Faltas: ${p.faltas ?? 0}`,
    margin,
    finalY,
  );
  doc.setTextColor(0);

  // Assinatura
  finalY += 36;
  doc.setLineWidth(0.4);
  doc.line(margin, finalY, margin + 240, finalY);
  doc.line(pageWidth - margin - 240, finalY, pageWidth - margin, finalY);
  doc.setFontSize(8);
  doc.text("Assinatura do empregador", margin, finalY + 11);
  doc.text("Assinatura do funcionário (declaro ter recebido)", pageWidth - margin - 240, finalY + 11);

  finalY += 24;
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, margin, finalY);
  doc.setTextColor(0);

  return finalY;
}

export function gerarHoleritePDF(p: HoleritePDFPayload): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  adicionarHoleritePDF(doc, p, 40);
  return doc;
}

export function baixarHoleritePDF(p: HoleritePDFPayload) {
  const doc = gerarHoleritePDF(p);
  doc.save(nomeArquivoHolerite(p));
}

export function gerarHoleritesLotePDF(
  empresa: HoleriteEmpresa,
  competencia: string,
  itens: Omit<HoleritePDFPayload, "empresa" | "competencia">[],
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  itens.forEach((item, idx) => {
    if (idx > 0) doc.addPage();
    adicionarHoleritePDF(doc, { ...item, empresa, competencia }, 40);
  });
  doc.save(`holerites_${competencia}.pdf`);
}
