import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import type { EtiquetaTemplate } from "@/hooks/useEtiquetaTemplates";
import { CAMPOS_CATALOGO, labelPadrao, type CampoConfig } from "@/lib/etiquetas/campos";

const escapeHtml = (s: any) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function obterConteudoQR(t: EtiquetaTemplate, dados: Record<string, any>): string {
  switch (t.qr_code_conteudo) {
    case "os_url":
      return `${t.qr_code_url_base || ""}${dados.os_numero || ""}`;
    case "imei":
      return String(dados.imei || "");
    case "custom":
      return String(dados.qr_custom || dados.os_numero || "");
    case "os_numero":
    default:
      return String(dados.os_numero || "");
  }
}

function obterConteudoBarcode(t: EtiquetaTemplate, dados: Record<string, any>): string {
  switch (t.codigo_barras_conteudo) {
    case "sku":
      return String(dados.sku || "");
    case "imei":
      return String(dados.imei || "");
    case "custom":
      return String(dados.barcode_custom || dados.os_numero || "");
    case "os_numero":
    default:
      return String(dados.os_numero || "");
  }
}

function gerarBarcodeSVG(value: string, alturaMm: number): string {
  if (!value) return "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, value, {
      format: "CODE128",
      width: 1.2,
      height: alturaMm * 3.78,
      displayValue: true,
      fontSize: 10,
      margin: 0,
    });
    return svg.outerHTML;
  } catch {
    return "";
  }
}

function renderCampo(t: EtiquetaTemplate, config: CampoConfig, dados: Record<string, any>): string {
  const id = config.id;
  if (id === "logo") {
    if (!t.mostrar_logo || !dados.logo_url) return "";
    const justify = t.logo_posicao === "topo_esquerda" ? "flex-start"
      : t.logo_posicao === "topo_direita" ? "flex-end"
      : "center";
    return `<div style="display:flex;justify-content:${justify};margin-bottom:1mm"><img src="${escapeHtml(dados.logo_url)}" style="height:${t.logo_altura_mm}mm;max-width:100%;object-fit:contain"/></div>`;
  }
  const valor = dados[id];
  if (valor === undefined || valor === null || valor === "") return "";

  const label = config.mostrar_label
    ? `<span style="color:#666">${escapeHtml(config.label_custom || labelPadrao(id))}: </span>`
    : "";
  const tam = config.tamanho || "normal";
  const fontSizePt =
    tam === "titulo" ? t.fonte_tamanho_titulo
    : tam === "grande" ? t.fonte_tamanho_titulo - 1
    : tam === "pequeno" ? t.fonte_tamanho_pequeno
    : t.fonte_tamanho_base;
  const fontWeight = config.negrito || tam === "titulo" ? "bold" : "normal";
  const alinhCss = config.alinhamento === "centro" ? "center"
    : config.alinhamento === "direita" ? "right"
    : "left";

  return `<div style="font-size:${fontSizePt}pt;font-weight:${fontWeight};text-align:${alinhCss};line-height:1.25;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${label}${escapeHtml(valor)}</div>`;
}

/** Renderiza UMA etiqueta como bloco HTML (sem <html> wrapper) */
export async function renderEtiquetaBloco(
  template: EtiquetaTemplate,
  dados: Record<string, any>
): Promise<string> {
  const camposVisiveis = template.campos_visiveis || [];
  // Constrói ordem: usa campos_config para ordem + flags; fallback à ordem em campos_visiveis
  const configById: Record<string, CampoConfig> = {};
  (template.campos_config || []).forEach((c: CampoConfig) => { configById[c.id] = c; });
  const camposOrdenados: CampoConfig[] = camposVisiveis
    .filter((id) => id !== "logo" && id !== "qr_code" && id !== "codigo_barras")
    .map((id) => configById[id] || { id, mostrar_label: true, tamanho: "normal", alinhamento: "esquerda" });

  const camposHTML = camposOrdenados.map((c) => renderCampo(template, c, dados)).join("");

  const logoHTML = template.mostrar_logo
    ? renderCampo(template, { id: "logo" }, dados)
    : "";

  let qrHTML = "";
  if (template.mostrar_qr_code) {
    const conteudo = obterConteudoQR(template, dados);
    if (conteudo) {
      const svg = await QRCode.toString(conteudo, { type: "svg", margin: 0, width: template.qr_code_tamanho_mm * 4 });
      const posStyles =
        template.qr_code_posicao === "esquerda" ? "position:absolute;left:1mm;bottom:1mm"
        : template.qr_code_posicao === "direita" ? "position:absolute;right:1mm;bottom:1mm"
        : template.qr_code_posicao === "centro_topo" ? "display:flex;justify-content:center;margin:1mm 0"
        : "display:flex;justify-content:center;margin-top:auto";
      qrHTML = `<div style="${posStyles};width:${template.qr_code_tamanho_mm}mm;height:${template.qr_code_tamanho_mm}mm">${svg}</div>`;
    }
  }

  let barcodeHTML = "";
  if (template.mostrar_codigo_barras) {
    const value = obterConteudoBarcode(template, dados);
    const svg = gerarBarcodeSVG(value, template.codigo_barras_altura_mm);
    if (svg) barcodeHTML = `<div style="display:flex;justify-content:center;margin-top:1mm">${svg}</div>`;
  }

  const rodapeHTML = template.texto_rodape
    ? `<div style="font-size:${template.fonte_tamanho_pequeno}pt;color:#555;margin-top:auto;text-align:center;line-height:1.2;padding-top:1mm">${escapeHtml(template.texto_rodape)}${template.mostrar_data_impressao ? ` · ${new Date().toLocaleDateString("pt-BR")}` : ""}</div>`
    : template.mostrar_data_impressao
    ? `<div style="font-size:${template.fonte_tamanho_pequeno}pt;color:#888;text-align:right;margin-top:auto">${new Date().toLocaleDateString("pt-BR")}</div>`
    : "";

  return `
    <div class="etiqueta-bloco" style="
      position:relative;
      width:${template.largura_mm}mm;
      height:${template.altura_mm}mm;
      padding:${template.margem_topo_mm}mm ${template.margem_lateral_mm}mm;
      box-sizing:border-box;
      overflow:hidden;
      font-family:${template.fonte_familia},sans-serif;
      font-size:${template.fonte_tamanho_base}pt;
      display:flex;
      flex-direction:column;
      background:#fff;
      color:#000;
    ">
      ${logoHTML}
      ${camposHTML}
      ${barcodeHTML}
      ${qrHTML}
      ${rodapeHTML}
    </div>`;
}

/** Renderiza HTML completo pronto pra window.print(). Aceita 1+ itens de dados. */
export async function renderEtiquetaHTML(
  template: EtiquetaTemplate,
  dadosList: Record<string, any> | Record<string, any>[]
): Promise<string> {
  const lista = Array.isArray(dadosList) ? dadosList : [dadosList];
  const blocos = await Promise.all(lista.map((d) => renderEtiquetaBloco(template, d)));

  const isA4 = template.tipo_impressora === "a4_multipla";
  const pageCss = isA4
    ? `@page { size: A4; margin: 8mm; }`
    : `@page { size: ${template.largura_mm}mm ${template.altura_mm}mm; margin: 0; }`;

  const containerStyle = isA4
    ? `display:grid;grid-template-columns:repeat(${template.etiquetas_por_linha},1fr);gap:${template.espacamento_vertical_mm}mm ${template.espacamento_horizontal_mm}mm;`
    : ``;

  const blocosComBreak = isA4
    ? blocos.join("")
    : blocos.map((b, i) => i === 0 ? b : `<div style="page-break-before:always"></div>${b}`).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Etiqueta</title>
<style>
  ${pageCss}
  html, body { margin: 0; padding: 0; background: #fff; }
  .etiqueta-container { ${containerStyle} }
  @media print { .no-print { display: none !important; } }
</style>
</head>
<body>
  <div class="etiqueta-container">${blocosComBreak}</div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => { window.print(); }, 200);
    });
  </script>
</body>
</html>`;
}

/** Abre nova janela e imprime */
export async function imprimirEtiquetas(
  template: EtiquetaTemplate,
  dados: Record<string, any> | Record<string, any>[]
) {
  const html = await renderEtiquetaHTML(template, dados);
  const w = window.open("", "_blank", "width=420,height=600");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
