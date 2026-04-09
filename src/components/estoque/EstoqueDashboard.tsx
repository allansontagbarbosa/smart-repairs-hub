import { Package, Smartphone, Cpu, Headphones, AlertTriangle, DollarSign } from "lucide-react";

const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

interface Props {
  kpis: {
    total: number;
    aparelhos: number;
    pecas: number;
    acessorios: number;
    estoqueBaixo: number;
    valorTotal: number;
  };
}

export function EstoqueDashboard({ kpis }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      <div className="stat-card">
        <Package className="h-4 w-4 text-primary mb-3" />
        <p className="stat-value">{kpis.total}</p>
        <p className="stat-label">Total de itens</p>
      </div>
      <div className="stat-card">
        <Smartphone className="h-4 w-4 text-info mb-3" />
        <p className="stat-value">{kpis.aparelhos}</p>
        <p className="stat-label">Aparelhos</p>
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
  );
}
