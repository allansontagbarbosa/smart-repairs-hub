import { useFatoresExternos } from "@/hooks/useFatoresExternos";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const weatherIcon = (code: number) => {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 99) return "⛈️";
  return "🌤️";
};

export function FatoresExternosCards() {
  const { data, isLoading } = useFatoresExternos();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando fatores externos…
        </CardContent>
      </Card>
    );
  }

  if (!data?.sucesso) return null;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-end justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider">
            Fatores externos pesando agora
          </h3>
          <span className="text-xs text-muted-foreground">
            Atualizado:{" "}
            {new Date(data.atualizado_em).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {data.dolar && (
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                DÓLAR (PTAX)
              </div>
              <div className="text-xl font-bold mt-1">
                R$ {data.dolar.valor.toFixed(2).replace(".", ",")}
              </div>
              {data.dolar.variacao_30d_pct !== null && (
                <div
                  className={`text-xs mt-1 ${
                    data.dolar.variacao_30d_pct >= 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {data.dolar.variacao_30d_pct >= 0 ? "↑" : "↓"}{" "}
                  {Math.abs(data.dolar.variacao_30d_pct).toFixed(1)}% em 30d
                </div>
              )}
              <div className="text-[10px] text-muted-foreground mt-1">
                Impacta peças importadas
              </div>
            </div>
          )}

          {data.selic && (
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                SELIC ANUAL
              </div>
              <div className="text-xl font-bold mt-1">
                {data.selic.valor_anual_pct.toFixed(2)}%
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Custo de capital
              </div>
            </div>
          )}

          {data.clima && (
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                {data.clima.cidade.toUpperCase()}{" "}
                <span>{weatherIcon(data.clima.weather_code_atual)}</span>
              </div>
              <div className="text-xl font-bold mt-1">
                {data.clima.temperatura_atual.toFixed(0)}°C
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {data.clima.dias_chuva_proxima_semana > 0
                  ? `${data.clima.dias_chuva_proxima_semana}d c/ chuva na semana`
                  : "Sem chuva na semana"}
              </div>
            </div>
          )}

          {data.feriados_proximos.length > 0 && (
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                PRÓXIMO FERIADO
              </div>
              <div className="text-sm font-bold mt-1 leading-tight">
                {data.feriados_proximos[0].nome}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Em {data.feriados_proximos[0].dias_ate} dias (
                {new Date(data.feriados_proximos[0].data).toLocaleDateString("pt-BR")})
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
