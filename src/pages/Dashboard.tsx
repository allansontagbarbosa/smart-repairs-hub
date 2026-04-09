import { Wrench, Package, Clock, AlertTriangle, DollarSign, TrendingUp, TrendingDown, CheckCircle } from "lucide-react";

const alerts = [
  { type: "danger" as const, message: "iPhone 14 de Maria Silva parado há 12 dias sem atualização" },
  { type: "warning" as const, message: "Samsung S23 de João Santos pronto há 5 dias — cliente não retirou" },
  { type: "warning" as const, message: "Motorola G54 de Ana Costa pronto há 3 dias — aguardando retirada" },
  { type: "info" as const, message: "Estoque de Tela iPhone 14: sistema mostra 2, conferência encontrou 1" },
];

const alertStyles = {
  danger: { bg: "bg-destructive/8", border: "border-destructive/20", icon: AlertTriangle, iconColor: "text-destructive" },
  warning: { bg: "bg-warning-muted", border: "border-warning/20", icon: Clock, iconColor: "text-warning" },
  info: { bg: "bg-info-muted", border: "border-info/20", icon: Package, iconColor: "text-info" },
};

export default function Dashboard() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Resumo geral da assistência</p>
      </div>

      {/* KPI Cards — row 1: Assistência */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <Wrench className="h-4 w-4 text-info mb-3" />
          <p className="stat-value">12</p>
          <p className="stat-label">Em assistência</p>
        </div>
        <div className="stat-card">
          <CheckCircle className="h-4 w-4 text-success mb-3" />
          <p className="stat-value">5</p>
          <p className="stat-label">Aguardando entrega</p>
        </div>
        <div className="stat-card">
          <Package className="h-4 w-4 text-muted-foreground mb-3" />
          <p className="stat-value">34</p>
          <p className="stat-label">Peças em estoque</p>
        </div>
        <div className="stat-card">
          <DollarSign className="h-4 w-4 text-muted-foreground mb-3" />
          <p className="stat-value">R$ 3.240</p>
          <p className="stat-label">Valor do estoque</p>
        </div>
      </div>

      {/* KPI Cards — row 2: Financeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card">
          <TrendingUp className="h-4 w-4 text-success mb-3" />
          <p className="stat-value">R$ 4.280</p>
          <p className="stat-label">Entradas do mês</p>
        </div>
        <div className="stat-card">
          <TrendingDown className="h-4 w-4 text-destructive mb-3" />
          <p className="stat-value">R$ 2.140</p>
          <p className="stat-label">Saídas do mês</p>
        </div>
        <div className="stat-card border-success/20 bg-success-muted">
          <DollarSign className="h-4 w-4 text-success mb-3" />
          <p className="stat-value text-success">R$ 2.140</p>
          <p className="stat-label">Lucro líquido do mês</p>
        </div>
      </div>

      {/* Alerts */}
      <div>
        <h2 className="section-title mb-3">Alertas</h2>
        <div className="space-y-2">
          {alerts.map((alert, i) => {
            const style = alertStyles[alert.type];
            const Icon = style.icon;
            return (
              <div key={i} className={`flex items-start gap-3 rounded-lg border ${style.border} ${style.bg} px-4 py-3`}>
                <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${style.iconColor}`} />
                <p className="text-sm">{alert.message}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
