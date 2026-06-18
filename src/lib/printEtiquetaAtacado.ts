import JsBarcode from "jsbarcode";
import { formatBRL } from "@/lib/utils";

export interface EtiquetaAtacadoData {
  modelo: string;
  capacidade?: string | null;
  cor?: string | null;
  imei?: string | null;
  preco?: number | null;
}

export function printEtiquetaAtacado(data: EtiquetaAtacadoData) {
  let barcodeSvg = "";
  if (data.imei) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    try {
      JsBarcode(svg, data.imei, {
        format: "CODE128",
        width: 1.4,
        height: 36,
        displayValue: false,
        margin: 0,
      });
      barcodeSvg = svg.outerHTML;
    } catch {
      barcodeSvg = "";
    }
  }
  const aparelho = `${data.modelo}${data.capacidade ? ` ${data.capacidade}` : ""}${data.cor ? ` · ${data.cor}` : ""}`.trim();
  const html = `<!DOCTYPE html><html><head><title>Etiqueta</title>
<style>
@page { size: 62mm 40mm; margin: 0; }
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:62mm;height:40mm;font-family:Arial,sans-serif}
.lbl{width:62mm;height:40mm;padding:2mm;display:flex;flex-direction:column;gap:1mm;overflow:hidden}
.mod{font-size:10px;font-weight:bold;line-height:1.1}
.bar{display:flex;flex-direction:column;align-items:center;line-height:1}
.bar svg{max-width:100%;height:10mm}
.imei{font-family:'Courier New',monospace;font-size:7px;letter-spacing:.4px;margin-top:.5mm}
.preco{font-size:14px;font-weight:bold;text-align:right;margin-top:auto}
@media print{body *{visibility:hidden}.lbl,.lbl *{visibility:visible}.lbl{position:absolute;top:0;left:0}}
</style></head><body>
<div class="lbl">
  <div class="mod">${aparelho}</div>
  ${barcodeSvg ? `<div class="bar">${barcodeSvg}<div class="imei">${data.imei}</div></div>` : ""}
  ${data.preco != null && data.preco > 0 ? `<div class="preco">${formatBRL(data.preco)}</div>` : ""}
</div>
</body></html>`;

  const w = window.open("", "_blank", "width=420,height=300");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.print(); };
}
