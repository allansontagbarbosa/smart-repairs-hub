import { supabase } from "@/integrations/supabase/client";
import JsBarcode from "jsbarcode";

export interface EtiquetaPrintData {
  numero: number;
  clienteNome: string;
  clienteTelefone: string;
  marca: string;
  modelo: string;
  capacidade?: string | null;
  defeitos: string;
  dataEntrada: string;
  previsaoEntrega?: string | null;
  valor?: number | null;
  imei?: string | null;
  tecnicoAtribuido?: string | null;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function fmtCurrency(v: number | null | undefined) {
  return v != null ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";
}

export async function printEtiquetaOS(data: EtiquetaPrintData) {
  // Fetch active technicians
  const { data: tecnicos } = await supabase
    .from("funcionarios")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  const tecList = tecnicos || [];

  // Generate barcode SVG if IMEI exists
  let barcodeSvg = "";
  if (data.imei) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    try {
      JsBarcode(svg, data.imei, {
        format: "CODE128",
        width: 1,
        height: 28,
        displayValue: false,
        margin: 0,
      });
      barcodeSvg = svg.outerHTML;
    } catch {
      barcodeSvg = "";
    }
  }

  const defeitosLines = data.defeitos.split("; ");

  const tecnicosHtml = tecList
    .map(t => `<span class="tecnico-item">[${data.tecnicoAtribuido === t.nome ? "✓" : "&nbsp;"}] ${t.nome.split(" ")[0]}</span>`)
    .join(" ");

  const barcodeSection = data.imei
    ? `<div class="divider"></div>
       <div class="barcode-section">
         ${barcodeSvg}
         <div class="imei-text">${data.imei}</div>
       </div>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Etiqueta OS #${String(data.numero).padStart(3, "0")}</title>
  <style>
    @page { margin: 0; size: 62mm 100mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 62mm; height: 100mm;
      font-family: 'Arial Narrow', Arial, sans-serif;
      font-size: 9px; line-height: 1.3;
      padding: 2mm; overflow: hidden;
    }
    .header { font-size: 14px; font-weight: bold; margin-bottom: 1px; }
    .client-name { font-size: 11px; font-weight: 600; }
    .client-phone { font-size: 9px; color: #444; }
    .divider { border-top: 1px dashed #999; margin: 2mm 0; }
    .device { font-size: 10px; font-weight: 600; }
    .defeitos { font-size: 8px; color: #333; margin-top: 1px; white-space: pre-wrap; }
    .info-row { display: flex; justify-content: space-between; font-size: 9px; }
    .info-label { color: #666; }
    .info-value { font-weight: 600; }
    .tecnicos { display: flex; flex-wrap: wrap; gap: 3px 8px; font-size: 8px; margin-top: 1px; }
    .tecnico-item { white-space: nowrap; }
    .tecnico-label { font-size: 8px; color: #666; margin-bottom: 1px; }
    .barcode-section { text-align: center; margin-top: 1mm; }
    .barcode-section svg { max-width: 100%; }
    .imei-text { font-family: 'Courier New', monospace; font-size: 7px; color: #333; letter-spacing: 0.5px; }
  </style>
</head>
<body>
  <div class="header">OS #${String(data.numero).padStart(3, "0")}</div>
  <div class="client-name">${data.clienteNome}</div>
  <div class="client-phone">${data.clienteTelefone}</div>
  <div class="divider"></div>
  <div class="device">${data.marca} ${data.modelo}${data.capacidade ? ` ${data.capacidade}` : ""}</div>
  <div class="defeitos">Defeitos: ${defeitosLines.join(";\n          ")}</div>
  <div class="divider"></div>
  <div class="info-row"><span class="info-label">Entrada:</span><span class="info-value">${fmtDate(data.dataEntrada)}</span></div>
  <div class="info-row"><span class="info-label">Previsão:</span><span class="info-value">${fmtDate(data.previsaoEntrega)}</span></div>
  <div class="info-row"><span class="info-label">Valor:</span><span class="info-value">${fmtCurrency(data.valor)}</span></div>
  <div class="divider"></div>
  <div class="tecnico-label">Técnico:</div>
  <div class="tecnicos">${tecnicosHtml}</div>
  ${barcodeSection}
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=300,height=500");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
}
