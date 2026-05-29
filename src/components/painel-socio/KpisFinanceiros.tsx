import { Card, CardContent } from "@/components/ui/card";

interface Props {
  faturamento: number;
  ebitda: number;
  ebitdaMargem: number;
  lucroLiquido: number;
  lucroMargem: number;
  saudeLabel: string;
  saudeNivel: 1 | 2 | 3 | 4 | 5;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const SAUDE_BG: Record<number, string> = {
  1: "bg-destructive/10 text-destructive",
  2: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  3: "bg-muted text-foreground",
  4: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  5: "bg-primary/10 text-primary",
};

export function KpisFinanceiros({
  faturamento,
  ebitda,
  ebitdaMargem,
  lucroLiquido,
  lucroMargem,
  saudeLabel,
  saudeNivel,
}: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Faturamento</div>
          <div className="text-2xl font-bold mt-1">{brl(faturamento)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">EBITDA</div>
          <div className="text-2xl font-bold mt-1">{brl(ebitda)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{ebitdaMargem.toFixed(1)}% margem</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Lucro líquido</div>
          <div className="text-2xl font-bold mt-1">{brl(lucroLiquido)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{lucroMargem.toFixed(1)}% margem</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Saúde financeira</div>
          <div className={`mt-2 inline-flex px-2.5 py-1 rounded-md text-sm font-semibold ${SAUDE_BG[saudeNivel]}`}>
            {saudeLabel}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Nível {saudeNivel}/5</div>
        </CardContent>
      </Card>
    </div>
  );
}
