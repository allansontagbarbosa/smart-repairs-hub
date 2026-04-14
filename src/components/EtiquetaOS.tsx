import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Barcode from "react-barcode";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EtiquetaData {
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

interface Props {
  data: EtiquetaData;
  showButton?: boolean;
}

export function EtiquetaOS({ data, showButton = true }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data: tecnicos = [] } = useQuery({
    queryKey: ["tecnicos_etiqueta"],
    queryFn: async () => {
      const { data: funcs } = await supabase
        .from("funcionarios")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return funcs || [];
    },
  });

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR");
  };

  const fmtCurrency = (v: number | null | undefined) =>
    v != null ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank", "width=300,height=500");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta OS #${String(data.numero).padStart(3, "0")}</title>
        <style>
          @page {
            margin: 0;
            size: 62mm 100mm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            width: 62mm;
            height: 100mm;
            font-family: 'Arial Narrow', Arial, sans-serif;
            font-size: 9px;
            line-height: 1.3;
            padding: 2mm;
            overflow: hidden;
          }
          .header {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 1px;
          }
          .client-name {
            font-size: 11px;
            font-weight: 600;
          }
          .client-phone {
            font-size: 9px;
            color: #444;
          }
          .divider {
            border-top: 1px dashed #999;
            margin: 2mm 0;
          }
          .device {
            font-size: 10px;
            font-weight: 600;
          }
          .defeitos {
            font-size: 8px;
            color: #333;
            margin-top: 1px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            font-size: 9px;
          }
          .info-label {
            color: #666;
          }
          .info-value {
            font-weight: 600;
          }
          .tecnicos {
            display: flex;
            flex-wrap: wrap;
            gap: 3px 8px;
            font-size: 8px;
            margin-top: 1px;
          }
          .tecnico-item {
            white-space: nowrap;
          }
          .tecnico-label {
            font-size: 8px;
            color: #666;
            margin-bottom: 1px;
          }
          .barcode-section {
            text-align: center;
            margin-top: 1mm;
          }
          .barcode-section svg {
            max-width: 100%;
          }
          .imei-text {
            font-family: 'Courier New', monospace;
            font-size: 7px;
            color: #333;
            letter-spacing: 0.5px;
          }
          page-break-after: always;
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  const defeitosLines = data.defeitos.split("; ");

  return (
    <>
      {/* Hidden print content */}
      <div ref={printRef} className="hidden">
        <div className="header">OS #{String(data.numero).padStart(3, "0")}</div>
        <div className="client-name">{data.clienteNome}</div>
        <div className="client-phone">{data.clienteTelefone}</div>
        <div className="divider"></div>
        <div className="device">
          {data.marca} {data.modelo}{data.capacidade ? ` ${data.capacidade}` : ""}
        </div>
        <div className="defeitos">
          Defeitos: {defeitosLines.map((d, i) => (
            <span key={i}>{i > 0 && <br />}{i > 0 ? "          " : ""}{d}{i < defeitosLines.length - 1 ? ";" : ""}</span>
          ))}
        </div>
        <div className="divider"></div>
        <div className="info-row">
          <span className="info-label">Entrada:</span>
          <span className="info-value">{fmtDate(data.dataEntrada)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Previsão:</span>
          <span className="info-value">{fmtDate(data.previsaoEntrega)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Valor:</span>
          <span className="info-value">{fmtCurrency(data.valor)}</span>
        </div>
        <div className="divider"></div>
        <div className="tecnico-label">Técnico:</div>
        <div className="tecnicos">
          {tecnicos.map(t => (
            <span key={t.id} className="tecnico-item">
              [{data.tecnicoAtribuido === t.nome ? "✓" : " "}] {t.nome.split(" ")[0]}
            </span>
          ))}
        </div>
        {data.imei && (
          <>
            <div className="divider"></div>
            <div className="barcode-section">
              <Barcode
                value={data.imei}
                format="CODE128"
                width={1}
                height={28}
                displayValue={false}
                margin={0}
              />
              <div className="imei-text">{data.imei}</div>
            </div>
          </>
        )}
      </div>

      {/* Visible preview */}
      {showButton && (
        <Button onClick={handlePrint} variant="outline" size="sm">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir Etiqueta
        </Button>
      )}

      {/* Preview card for confirmation screen */}
      <div className="etiqueta-preview border rounded-lg p-3 bg-card text-card-foreground max-w-[250px] mx-auto text-[9px] leading-tight font-mono space-y-1">
        <div className="text-sm font-bold">OS #{String(data.numero).padStart(3, "0")}</div>
        <div className="text-[10px] font-semibold">{data.clienteNome}</div>
        <div className="text-muted-foreground">{data.clienteTelefone}</div>
        <div className="border-t border-dashed my-1" />
        <div className="text-[10px] font-semibold">
          {data.marca} {data.modelo}{data.capacidade ? ` ${data.capacidade}` : ""}
        </div>
        <div className="text-muted-foreground">
          Defeitos: {defeitosLines.slice(0, 2).join("; ")}
          {defeitosLines.length > 2 && "..."}
        </div>
        <div className="border-t border-dashed my-1" />
        <div className="flex justify-between"><span className="text-muted-foreground">Entrada:</span><span>{fmtDate(data.dataEntrada)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Previsão:</span><span>{fmtDate(data.previsaoEntrega)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Valor:</span><span className="font-semibold">{fmtCurrency(data.valor)}</span></div>
        <div className="border-t border-dashed my-1" />
        <div className="text-muted-foreground text-[8px]">Técnico:</div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[8px]">
          {tecnicos.map(t => (
            <span key={t.id}>[{data.tecnicoAtribuido === t.nome ? "✓" : " "}] {t.nome.split(" ")[0]}</span>
          ))}
        </div>
        {data.imei && (
          <>
            <div className="border-t border-dashed my-1" />
            <div className="flex justify-center">
              <Barcode
                value={data.imei}
                format="CODE128"
                width={1}
                height={20}
                displayValue={false}
                margin={0}
              />
            </div>
            <div className="text-center text-[7px] font-mono text-muted-foreground tracking-wider">{data.imei}</div>
          </>
        )}
      </div>
    </>
  );
}

export function PrintEtiquetaButton({ data }: { data: EtiquetaData }) {
  return <EtiquetaOS data={data} showButton={true} />;
}
