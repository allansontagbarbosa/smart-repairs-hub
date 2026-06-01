import { supabase } from "@/integrations/supabase/client";
import JsBarcode from "jsbarcode";
import { formatNumeroOS } from "@/lib/numeroOS";

export interface EtiquetaPrintData {
  numero: number;
  numero_formatado?: string | null;
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

export async function printEtiquetaOS(data: EtiquetaPrintData) {
  // Generate barcode SVG if IMEI exists
  let barcodeSvg = "";
  if (data.imei) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    try {
      JsBarcode(svg, data.imei, {
        format: "CODE128",
        width: 1,
        height: 18,
        displayValue: false,
        margin: 0,
      });
      barcodeSvg = svg.outerHTML;
    } catch {
      barcodeSvg = "";
    }
  }

  const numeroOS = formatNumeroOS(data.numero, data.numero_formatado);
  const aparelho = `${data.marca} ${data.modelo}${data.capacidade ? ` ${data.capacidade}` : ""}`.trim();

  const barcodeSection = data.imei
    ? `<div class="barcode-section">
         ${barcodeSvg}
         <div class="imei-text">${data.imei}</div>
       </div>`
    : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Etiqueta OS #${numeroOS}</title>
  <style>
    /* tamanho EXATO da etiqueta Dymo 11352 em paisagem (54 x 25 mm) */
    @page {
      size: 54mm 25mm;
      margin: 0;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      width: 54mm;
      height: 25mm;
      font-family: 'Arial Narrow', Arial, sans-serif;
    }

    .etiqueta-print {
      width: 54mm;
      height: 25mm;
      box-sizing: border-box;
      padding: 2mm 3mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      overflow: hidden;
      gap: 0.4mm;
    }

    .etiqueta-print * {
      max-width: 100%;
      word-break: break-word;
    }

    .os-num { font-size: 10px; font-weight: bold; line-height: 1.1; }
    .cliente { font-size: 8px; font-weight: 600; line-height: 1.15; }
    .aparelho { font-size: 7.5px; line-height: 1.15; }
    .data { font-size: 6.5px; color: #333; line-height: 1.1; }
    .barcode-section { display: flex; flex-direction: column; align-items: center; line-height: 1; }
    .barcode-section svg { max-width: 100%; height: 7mm; }
    .imei-text { font-family: 'Courier New', monospace; font-size: 5.5px; color: #333; letter-spacing: 0.3px; }

    @media print {
      body * { visibility: hidden; }
      .etiqueta-print, .etiqueta-print * { visibility: visible; }
      .etiqueta-print {
        position: absolute;
        top: 0;
        left: 0;
      }
    }
  </style>
</head>
<body>
  <div class="etiqueta-print">
    <div class="os-num">OS #${numeroOS}</div>
    <div class="cliente">${data.clienteNome}</div>
    <div class="aparelho">${aparelho}</div>
    <div class="data">Entrada: ${fmtDate(data.dataEntrada)}${data.previsaoEntrega ? ` · Prev: ${fmtDate(data.previsaoEntrega)}` : ""}</div>
    ${barcodeSection}
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=400,height=250");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
}
