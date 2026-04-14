import { Package, Cpu, Headphones, AlertTriangle, DollarSign, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EstoqueItem } from "@/hooks/useEstoque";

const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

interface Props {
  kpis: {
    total: number;
    pecas: number;
    acessorios: number;
    estoqueBaixo: number;
    valorTotal: number;
  };
  itens?: EstoqueItem[];
  onRegistrarEntrada?: (itemId: string) => void;
}

export function EstoqueDashboard({ kpis, itens = [], onRegistrarEntrada }: Props) {
  const alertas = itens.filter(i => i.quantidade_minima > 0 && i.quantidade <= i.quantidade_minima);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="stat-card">
          <Package className="h-4 w-4 text-primary mb-3" />
          <p className="stat-value">{kpis.total}</p>
          <p className="stat-label">Total de peças</p>
        </div>
        <div className="stat-card">
          <Cpu className="h-4 w-4 text-warning mb-3" />
          <p className="stat-value">{kpis.pecas}</p>
          <p className="stat-label">Peças</p>
        </div>
        <div className="stat-card">
          <Headphones className="h-4 w-4 text-success mb-3" />
          <p className="stat-value">{kpis.acessorios}</p>
          <p className="stat-label">Acessórios</p>
        </div>
        <div className={`stat-card ${kpis.estoqueBaixo > 0 ? "border-destructive/20 bg-destructive/5" : ""}`}>
          <AlertTriangle className={`h-4 w-4 mb-3 ${kpis.estoqueBaixo > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          <p className={`stat-value ${kpis.estoqueBaixo > 0 ? "text-destructive" : ""}`}>{kpis.estoqueBaixo}</p>
          <p className="stat-label">Estoque baixo</p>
        </div>
        <div className="stat-card">
          <DollarSign className="h-4 w-4 text-success mb-3" />
          <p className="stat-value text-lg">{fmtCurrency(kpis.valorTotal)}</p>
          <p className="stat-label">Valor em estoque</p>
        </div>
      </div>

      {/* Stock alerts */}
      {alertas.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            <AlertTriangle className="h-3.5 w-3.5 inline mr-1 text-destructive" />
            Alertas de Estoque Baixo ({alertas.length})
          </p>
          <div className="space-y-2">
            {alertas.map((item) => {
              const nome = item.nome_personalizado || [item.marcas?.nome, item.modelos?.nome].filter(Boolean).join(" ") || item.sku || "Peça";
              const isCritical = item.quantidade === 0;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isCritical ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{nome}</p>
                    <p className={`text-xs ${isCritical ? "text-destructive" : "text-warning"}`}>
                      {item.quantidade} em estoque · mínimo {item.quantidade_minima}
                    </p>
                  </div>
                  {onRegistrarEntrada && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 ml-2 text-xs"
                      onClick={() => onRegistrarEntrada(item.id)}
                    >
                      Registrar Entrada <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
