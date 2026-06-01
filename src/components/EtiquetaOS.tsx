import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Barcode from "react-barcode";
import { Printer, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printEtiquetaOS, type EtiquetaPrintData } from "@/lib/printEtiqueta";
import { formatNumeroOS } from "@/lib/numeroOS";

interface Props {
  data: EtiquetaPrintData;
  showButton?: boolean;
}

export function EtiquetaOS({ data, showButton = true }: Props) {
  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR");
  };

  const numeroOS = formatNumeroOS(data.numero, data.numero_formatado);
  const aparelho = `${data.marca} ${data.modelo}${data.capacidade ? ` ${data.capacidade}` : ""}`.trim();

  return (
    <div className="space-y-2">
      {showButton && (
        <div className="flex flex-col gap-2">
          <Button onClick={() => printEtiquetaOS(data)} variant="outline" size="sm" className="w-fit">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir Etiqueta (Dymo 11352)
          </Button>
          <div className="text-[10px] text-muted-foreground flex items-start gap-1 max-w-[260px]">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              Na janela de impressão: <b>Destino</b> = Dymo, <b>Margens</b> = Nenhuma,
              <b> Escala</b> = 100%, <b>Papel</b> = 54×25mm. Desmarque "Cabeçalhos e rodapés".
            </span>
          </div>
        </div>
      )}

      {/* Preview no MESMO tamanho da impressão: 54mm x 25mm */}
      <div
        className="etiqueta-print bg-white text-black border border-dashed border-muted-foreground/40 mx-auto"
        style={{
          width: "54mm",
          height: "25mm",
          boxSizing: "border-box",
          padding: "2mm 3mm",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          overflow: "hidden",
          gap: "0.4mm",
          fontFamily: "'Arial Narrow', Arial, sans-serif",
        }}
      >
        <div style={{ fontSize: "10px", fontWeight: "bold", lineHeight: 1.1 }}>OS #{numeroOS}</div>
        <div style={{ fontSize: "8px", fontWeight: 600, lineHeight: 1.15 }}>{data.clienteNome}</div>
        <div style={{ fontSize: "7.5px", lineHeight: 1.15 }}>{aparelho}</div>
        <div style={{ fontSize: "6.5px", color: "#333", lineHeight: 1.1 }}>
          Entrada: {fmtDate(data.dataEntrada)}
          {data.previsaoEntrega ? ` · Prev: ${fmtDate(data.previsaoEntrega)}` : ""}
        </div>
        {data.imei && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
            <Barcode
              value={data.imei}
              format="CODE128"
              width={1}
              height={18}
              displayValue={false}
              margin={0}
            />
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: "5.5px", color: "#333", letterSpacing: "0.3px" }}>
              {data.imei}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
