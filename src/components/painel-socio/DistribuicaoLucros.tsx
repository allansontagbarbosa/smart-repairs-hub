import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Lock, Plus, Users } from "lucide-react";

export interface SocioDist {
  id: string;
  nome: string;
  pct: number;
  cota: number;
  retirado: number;
}

interface Props {
  socios: SocioDist[];
  lucroLiquido: number;
  reservaEmergencia: number;
  onLancarRetirada?: () => void;
  onFecharMes?: () => void;
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export function DistribuicaoLucros({
  socios,
  lucroLiquido,
  reservaEmergencia,
  onLancarRetirada,
  onFecharMes,
}: Props) {
  const distribuivel = Math.max(0, lucroLiquido - reservaEmergencia);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" /> Distribuição de lucros
        </CardTitle>
        <div className="flex gap-2">
          {onLancarRetirada && (
            <Button size="sm" variant="outline" onClick={onLancarRetirada}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Retirada
            </Button>
          )}
          {onFecharMes && (
            <Button size="sm" onClick={onFecharMes}>
              <Lock className="h-3.5 w-3.5 mr-1" /> Fechar mês
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="rounded-md bg-muted/40 p-3">
            <div className="text-muted-foreground uppercase tracking-wider">Lucro líquido</div>
            <div className="text-base font-semibold mt-1">{brl(lucroLiquido)}</div>
          </div>
          <div className="rounded-md bg-muted/40 p-3">
            <div className="text-muted-foreground uppercase tracking-wider">Reserva</div>
            <div className="text-base font-semibold mt-1">{brl(reservaEmergencia)}</div>
          </div>
          <div className="rounded-md bg-primary/10 p-3">
            <div className="text-primary uppercase tracking-wider">Distribuível</div>
            <div className="text-base font-semibold mt-1 text-primary">{brl(distribuivel)}</div>
          </div>
        </div>

        {socios.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum sócio cadastrado.
          </p>
        ) : (
          <div className="space-y-3">
            {socios.map((s) => {
              const pctRetirado = s.cota > 0 ? Math.min(100, (s.retirado / s.cota) * 100) : 0;
              return (
                <div key={s.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {s.nome}{" "}
                      <span className="text-xs text-muted-foreground">({s.pct.toFixed(1)}%)</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {brl(s.retirado)} de {brl(s.cota)}
                    </span>
                  </div>
                  <Progress value={pctRetirado} />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
