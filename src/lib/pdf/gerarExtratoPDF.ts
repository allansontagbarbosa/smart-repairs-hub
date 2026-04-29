import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ExtratoClienteItem } from "@/hooks/useExtratoCliente";

export type ExtratoPDFCliente = {
  id: string;
  nome: string;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  cpf?: string | null;
};

export type ExtratoPDFEmpresa = {
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  cnpj?: string | null;
  endereco?: unknown;
};

export type ExtratoPDFPayload = {
  cliente: ExtratoPDFCliente;
  periodo: { inicio: string; fim: string };
  extrato: ExtratoClienteItem[];
  resumo: {
    totalFaturadoPeriodo: number;
    totalRecebidoPeriodo: number;
    saldoDevedorAtual: number;
  };
  empresa?: ExtratoPDFEmpresa | null;
};

const currency = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const date = (value: string | null | undefined) =>
  value ? new Date(value.includes("T") ? value : `${value}T00:00:00`).toLocaleDateString("pt-BR") : "—";

const nowLabel = () => new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const sanitizeFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "cliente";

const aparelhoImei = (item: ExtratoClienteItem) => {
  if (item.tipo === "pagamento") return "—";
  return [item.modelo_aparelho, item.imei ? `IMEI ${item.imei}` : null].filter(Boolean).join("\n") || "—";
};

const servicosLabel = (item: ExtratoClienteItem) => {
  if (item.tipo === "pagamento") return item.descricao.replace(/^Pagamento\s*/i, "") || "—";
  return item.servicos_realizados || "—";
};

function enderecoToText(endereco: unknown) {
  if (!endereco || typeof endereco !== "object") return "";
  const e = endereco as Record<string, unknown>;
  return [e.logradouro, e.numero, e.bairro, e.cidade, e.uf].filter(Boolean).join(", ");
}

export function nomeArquivoExtratoPDF(payload: Pick<ExtratoPDFPayload, "cliente" | "periodo">) {
  const month = payload.periodo.inicio.slice(0, 7);
  return `extrato_${sanitizeFileName(payload.cliente.nome)}_${month}.pdf`;
}

export function gerarExtratoPDF(payload: ExtratoPDFPayload) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const empresaNome = payload.empresa?.nome || "AssistPro";
  const empresaInfo = [payload.empresa?.cnpj, payload.empresa?.telefone, payload.empresa?.email, enderecoToText(payload.empresa?.endereco)]
    .filter(Boolean)
    .join(" • ");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(empresaNome, margin, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (empresaInfo) doc.text(empresaInfo, margin, 58, { maxWidth: pageWidth - margin * 2 });

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1.5);
  doc.line(margin, 76, pageWidth - margin, 76);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Extrato de Cliente", margin, 104);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Cliente: ${payload.cliente.nome}`, margin, 128);
  doc.text(`Telefone: ${payload.cliente.whatsapp || payload.cliente.telefone || "—"}`, margin, 144);
  doc.text(`CPF/CNPJ: ${payload.cliente.cpf || "—"}`, margin, 160);
  doc.text(`Período: ${date(payload.periodo.inicio)} a ${date(payload.periodo.fim)}`, pageWidth / 2, 128);
  doc.text(`Gerado em: ${nowLabel()}`, pageWidth / 2, 144);

  autoTable(doc, {
    startY: 186,
    margin: { left: margin, right: margin },
    tableWidth: pageWidth - margin * 2,
    theme: "grid",
    head: [["Data", "OS", "Aparelho/IMEI", "Serviço(s)", "Débito", "Crédito", "Saldo"]],
    body: payload.extrato.map((item) => [
      date(item.data),
      item.descricao,
      aparelhoImei(item),
      servicosLabel(item),
      Number(item.debito) > 0 ? currency(item.debito) : "—",
      Number(item.credito) > 0 ? currency(item.credito) : "—",
      currency(item.saldo_apos),
    ]),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 3, overflow: "linebreak", minCellWidth: 10 },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 54 },
      1: { cellWidth: 74 },
      2: { cellWidth: 196 },
      3: { cellWidth: 166 },
      4: { halign: "right", cellWidth: 68 },
      5: { halign: "right", cellWidth: 68 },
      6: { halign: "right", cellWidth: 68 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === "body") {
        const item = payload.extrato[data.row.index];
        if (item?.tipo === "pagamento") data.cell.styles.fillColor = [240, 253, 244];
      }
    },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 186;
  const summaryY = Math.min(finalY + 28, pageHeight - 92);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, summaryY, pageWidth - margin * 2, 54, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Resumo", margin + 12, summaryY + 18);
  doc.setFont("helvetica", "normal");
  doc.text(`Total faturado: ${currency(payload.resumo.totalFaturadoPeriodo)}`, margin + 12, summaryY + 38);
  doc.text(`Total recebido: ${currency(payload.resumo.totalRecebidoPeriodo)}`, margin + 190, summaryY + 38);
  doc.text(`Saldo devedor atual: ${currency(payload.resumo.saldoDevedorAtual)}`, margin + 360, summaryY + 38);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Gerado por AssistPro em ${nowLabel()}`, margin, pageHeight - 24);
    doc.text(`Página ${i} de ${pages}`, pageWidth - margin - 55, pageHeight - 24);
    doc.setTextColor(0);
  }

  return doc;
}

export function baixarExtratoPDF(payload: ExtratoPDFPayload) {
  const doc = gerarExtratoPDF(payload);
  doc.save(nomeArquivoExtratoPDF(payload));
}
