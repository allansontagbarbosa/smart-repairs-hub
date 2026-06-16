import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type FaturaItem = {
  os_id: string;
  numero: string;
  aparelho: string | null;
  servico: string | null;
  data: string;
  valor_original: number;
  saldo_aberto: number;
  parcial: boolean;
};

export type FaturaPayload = {
  cliente: { id: string; nome: string };
  resumo: { faturado: number; pago: number; devedor: number };
  itens: FaturaItem[];
  quitados: { quantidade: number; numeros: string[] };
  empresa?: {
    nome?: string | null;
    telefone?: string | null;
    email?: string | null;
    cnpj?: string | null;
    endereco?: unknown;
  } | null;
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

function enderecoToText(endereco: unknown) {
  if (!endereco || typeof endereco !== "object") return "";
  const e = endereco as Record<string, unknown>;
  return [e.logradouro, e.numero, e.bairro, e.cidade, e.uf].filter(Boolean).join(", ");
}

export function nomeArquivoFaturaPDF(payload: Pick<FaturaPayload, "cliente">) {
  const today = new Date().toISOString().slice(0, 10);
  return `fatura_${sanitizeFileName(payload.cliente.nome)}_${today}.pdf`;
}

export function gerarFaturaPDF(payload: FaturaPayload) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const empresaNome = payload.empresa?.nome || "Ditt Software";
  const empresaInfo = [
    payload.empresa?.cnpj,
    payload.empresa?.telefone,
    payload.empresa?.email,
    enderecoToText(payload.empresa?.endereco),
  ]
    .filter(Boolean)
    .join(" • ");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(empresaNome, margin, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (empresaInfo) doc.text(empresaInfo, margin, 58, { maxWidth: pageWidth - margin * 2 });

  doc.setDrawColor(0, 200, 150);
  doc.setLineWidth(1.5);
  doc.line(margin, 76, pageWidth - margin, 76);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Fatura em aberto", margin, 104);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Cliente: ${payload.cliente.nome}`, margin, 128);
  doc.text(`Gerado em: ${nowLabel()}`, margin, 144);

  autoTable(doc, {
    startY: 170,
    margin: { left: margin, right: margin },
    tableWidth: pageWidth - margin * 2,
    theme: "grid",
    head: [["OS", "Data", "Aparelho / Serviço", "Valor"]],
    body: payload.itens.map((item) => [
      `#${item.numero}`,
      date(item.data),
      [item.aparelho, item.servico].filter(Boolean).join(" — ") +
        (item.parcial ? `\n(saldo parcial — original ${currency(item.valor_original)})` : ""),
      currency(item.saldo_aberto),
    ]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [0, 200, 150], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 60 },
      2: { cellWidth: "auto" },
      3: { halign: "right", cellWidth: 80 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 170;
  let y = finalY + 24;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 72, 4, 4, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Faturado: ${currency(payload.resumo.faturado)}`, margin + 12, y + 22);
  doc.text(`(−) Já pago: ${currency(payload.resumo.pago)}`, margin + 12, y + 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`A pagar: ${currency(payload.resumo.devedor)}`, margin + 12, y + 62);

  y += 92;

  if (payload.quitados.quantidade > 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100);
    const txt = `${payload.quitados.quantidade} aparelho(s) já quitado(s) (OS ${payload.quitados.numeros.join(", ")}) não constam nesta fatura.`;
    doc.text(txt, margin, y, { maxWidth: pageWidth - margin * 2 });
    doc.setTextColor(0);
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Gerado por Ditt Software em ${nowLabel()}`, margin, pageHeight - 24);
    doc.text(`Página ${i} de ${pages}`, pageWidth - margin - 55, pageHeight - 24);
    doc.setTextColor(0);
  }

  return doc;
}

export function baixarFaturaPDF(payload: FaturaPayload) {
  const doc = gerarFaturaPDF(payload);
  doc.save(nomeArquivoFaturaPDF(payload));
}
