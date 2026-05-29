import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";

interface Props {
  saldoCaixa: number;
  saldoBanco: number;
  burnRate: number;
  metaReservaMeses: number;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export function CaixaRunway({ saldoCaixa, saldoBanco, burnRate, metaReservaMeses }: Props) {
  const total = saldoCaixa + saldoBanco;
  const runwayMeses = burnRate > 0 ? total / burnRate : null;
  const pctMeta =
    runwayMeses !== null && metaReservaMeses > 0
      ? Math.min(100, (runwayMeses / metaReservaMeses) * 100)
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" /> Caixa & Runway
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-md bg-muted/40 p-3">
            <div className="text-muted-foreground uppercase tracking-wider">Caixa</div>
            <div className="text-base font-semibold mt-1">{brl(saldoCaixa)}</div>
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <div className="text-muted-foreground uppercase tracking-wider">Banco</div>
            <div className="text-base font-semibold mt-1">{brl(saldoBanco)}</div>
          </div>
        </div>
        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Burn rate mensal</span>
            <span className="font-medium">{brl(burnRate)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Runway</span>
            <span className="font-semibold">
              {runwayMeses === null ? "—" : `${runwayMeses.toFixed(1)} meses`}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pctMeta}%` }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground">
            Meta: {metaReservaMeses} meses de operação cobertos.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
