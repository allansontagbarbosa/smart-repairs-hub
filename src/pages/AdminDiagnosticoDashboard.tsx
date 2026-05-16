import { useDashboardOperacional } from "@/hooks/useDashboardOperacional";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

export default function AdminDiagnosticoDashboard() {
  const { data, loading, error, refetch, lastFetch } = useDashboardOperacional();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Diagnóstico do Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Validação dos dados retornados pela RPC <code>get_dashboard_operacional</code>
          </p>
        </div>
        <Button onClick={refetch} disabled={loading} variant="outline" size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Recarregar</span>
        </Button>
      </div>

      {lastFetch && (
        <p className="text-xs text-muted-foreground">
          Última atualização: {lastFetch.toLocaleString("pt-BR")}
        </p>
      )}

      {loading && !data && (
        <Card className="p-8 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando dados...</span>
        </Card>
      )}

      {error && (
        <Card className="p-4 border-destructive/50 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive">Erro ao carregar dashboard</h3>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {data && (
        <div className="space-y-6">
          <Card className="p-4 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="font-medium">RPC retornou com sucesso</span>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold mb-3">Bancadas dos técnicos</h2>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Total de técnicos: {data.bancadas?.length ?? 0}
              </p>
              {data.bancadas?.length > 0 ? (
                <ul className="divide-y">
                  {data.bancadas.map((b) => (
                    <li key={b.funcionario_id} className="py-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{b.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          recebido: {b.qtd_recebido} · análise: {b.qtd_em_analise} · aprovação: {b.qtd_aprovacao} · reparo: {b.qtd_em_reparo} · aguard. peça: {b.qtd_aguardando_peca}
                        </p>
                      </div>
                      <span className="text-lg font-bold tabular-nums">{b.qtd_total}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhum técnico ativo encontrado</p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold mb-3">Contadores de status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(data.contadores ?? {}).map(([key, value]) => (
                <div key={key} className="border rounded-md p-3">
                  <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                  <p className="text-xl font-bold tabular-nums">{String(value)}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-5">
              <h2 className="font-semibold mb-3">Caixa hoje</h2>
              <p className="text-2xl font-bold text-primary tabular-nums">
                R$ {Number(data.caixa_hoje?.entrada_hoje ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {data.caixa_hoje?.qtd_os_pagas ?? 0} OS pagas hoje
              </p>
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold mb-3">Lucro do mês</h2>
              <p className="text-2xl font-bold text-primary tabular-nums">
                R$ {Number(data.lucro_mes?.lucro ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                margem: {data.lucro_mes?.margem_pct ?? 0}% · regime: {data.lucro_mes?.regime}
              </p>
              <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                <p>receita: R$ {Number(data.lucro_mes?.receita ?? 0).toLocaleString("pt-BR")}</p>
                <p>custo peças: R$ {Number(data.lucro_mes?.custo_pecas ?? 0).toLocaleString("pt-BR")}</p>
                <p>custo comissão: R$ {Number(data.lucro_mes?.custo_comissao ?? 0).toLocaleString("pt-BR")}</p>
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="font-semibold mb-3">Estoque</h2>
            {data.estoque?.aviso ? (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" />
                <span>{data.estoque.aviso}</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="border rounded-md p-3">
                  <p className="text-xs text-muted-foreground">Total de peças</p>
                  <p className="text-xl font-bold tabular-nums">{data.estoque?.total_pecas ?? 0}</p>
                </div>
                <div className="border rounded-md p-3">
                  <p className="text-xs text-muted-foreground">Zeradas</p>
                  <p className="text-xl font-bold tabular-nums">{data.estoque?.zeradas ?? 0}</p>
                </div>
                {data.estoque?.estoque_baixo !== undefined && (
                  <div className="border rounded-md p-3">
                    <p className="text-xs text-muted-foreground">Estoque baixo</p>
                    <p className="text-xl font-bold tabular-nums">{data.estoque.estoque_baixo}</p>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold mb-3">
              Ranking — {String(data.ranking?.mes).padStart(2, "0")}/{data.ranking?.ano}
            </h2>
            {data.ranking?.tecnicos?.length > 0 ? (
              <ul className="divide-y">
                {data.ranking.tecnicos.map((t, idx) => (
                  <li key={t.funcionario_id} className="py-2 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                      {idx + 1}º
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">{t.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.qtd_concluidas} OS · R$ {Number(t.faturamento).toLocaleString("pt-BR")}
                        {t.pct_qtd !== null && ` · ${t.pct_qtd}% da meta de qtd`}
                        {t.pct_faturamento !== null && ` · ${t.pct_faturamento}% da meta de fat.`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Nenhum técnico com OS concluída neste mês
              </p>
            )}
          </Card>

          <details className="border rounded-md p-3">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
              Ver JSON cru (debug)
            </summary>
            <pre className="mt-3 text-xs bg-muted p-3 rounded overflow-auto max-h-96">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
