import { toast } from "sonner";

/**
 * Linha mínima esperada para exportar uma OS em CSV.
 * Compatível com a estrutura usada em Assistencia.tsx (ordens_de_servico + aparelhos.clientes).
 */
export type OSCsvRow = {
  numero: number | string;
  data_entrada: string | null;
  status: string;
  defeito_relatado: string | null;
  valor: number | null;
  custo_pecas: number | null;
  tecnico?: string | null;
  aparelhos?: {
    marca?: string | null;
    modelo?: string | null;
    imei?: string | null;
    capacidade?: string | null;
    clientes?: { nome?: string | null; telefone?: string | null } | null;
  } | null;
};

const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function timestampForFilename(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function exportOSToCSV(rows: OSCsvRow[]) {
  if (!rows || rows.length === 0) {
    toast.error("Nenhuma OS para exportar");
    return;
  }

  const headers = [
    "OS",
    "Data Entrada",
    "Cliente",
    "Telefone",
    "Aparelho",
    "IMEI",
    "Defeito Relatado",
    "Status",
    "Técnico",
    "Valor Total",
    "Custo Peças",
    "Lucro",
  ];

  const csvLines = [headers.map(escape).join(",")];

  for (const r of rows) {
    const valor = Number(r.valor ?? 0);
    const custo = Number(r.custo_pecas ?? 0);
    const lucro = valor - custo;
    const aparelho = [r.aparelhos?.marca, r.aparelhos?.modelo, r.aparelhos?.capacidade]
      .filter(Boolean)
      .join(" ");
    csvLines.push(
      [
        `#${String(r.numero).padStart(3, "0")}`,
        r.data_entrada ? new Date(r.data_entrada).toLocaleDateString("pt-BR") : "",
        r.aparelhos?.clientes?.nome ?? "",
        r.aparelhos?.clientes?.telefone ?? "",
        aparelho,
        r.aparelhos?.imei ?? "",
        r.defeito_relatado ?? "",
        r.status ?? "",
        r.tecnico ?? "",
        valor.toFixed(2).replace(".", ","),
        custo.toFixed(2).replace(".", ","),
        lucro.toFixed(2).replace(".", ","),
      ]
        .map(escape)
        .join(","),
    );
  }

  // \ufeff = BOM UTF-8 → faz o Excel abrir com acentos corretos
  const blob = new Blob(["\ufeff" + csvLines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `assistpro-os-export-${timestampForFilename()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast.success(`${rows.length} OS exportada${rows.length > 1 ? "s" : ""}`);
}
