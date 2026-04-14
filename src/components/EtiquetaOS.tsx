import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Barcode from "react-barcode";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printEtiquetaOS, type EtiquetaPrintData } from "@/lib/printEtiqueta";

interface Props {
  data: EtiquetaPrintData;
  showButton?: boolean;
}

export function EtiquetaOS({ data, showButton = true }: Props) {
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

  const defeitosLines = data.defeitos.split("; ");

  return (
    <>
      {showButton && (
        <Button onClick={() => printEtiquetaOS(data)} variant="outline" size="sm">
          <Printer className="h-4 w-4 mr-2" />
          Imprimir Etiqueta
        </Button>
      )}

      {/* Preview card for confirmation screen */}
      <div className="border rounded-lg p-3 bg-card text-card-foreground max-w-[250px] mx-auto text-[9px] leading-tight font-mono space-y-1">
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
