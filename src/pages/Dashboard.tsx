import { Wrench, Clock, DollarSign, Users, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

const stats = [
  { label: "Em Reparo", value: "12", icon: Wrench, color: "text-info" },
  { label: "Prontos p/ Retirada", value: "5", icon: Clock, color: "text-warning" },
  { label: "Receita do Mês", value: "R$ 4.280", icon: DollarSign, color: "text-success" },
  { label: "Clientes Ativos", value: "38", icon: Users, color: "text-muted-foreground" },
];

const recentOrders = [
  { id: "001", client: "Maria Silva", device: "iPhone 14", issue: "Tela quebrada", status: "em_reparo" as const },
  { id: "002", client: "João Santos", device: "Samsung S23", issue: "Bateria", status: "pronto" as const },
  { id: "003", client: "Ana Costa", device: "Motorola G54", issue: "Não liga", status: "aguardando" as const },
  { id: "004", client: "Pedro Lima", device: "iPhone 13", issue: "Troca de tela", status: "entregue" as const },
];

const lowStockItems = [
  { item: "Tela iPhone 14", qty: 2 },
  { item: "Bateria Samsung S23", qty: 1 },
  { item: "Conector USB-C", qty: 3 },
];

export default function Dashboard() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Visão geral da assistência</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className={`mb-3 ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="stat-value">{stat.value}</p>
            <p className="stat-label">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Two columns: Orders + Side info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Recent orders - takes 2/3 */}
        <div className="lg:col-span-2 section-card">
          <div className="section-header">
            <h2 className="section-title">Últimas Ordens</h2>
            <span className="text-xs text-muted-foreground">{recentOrders.length} recentes</span>
          </div>
          <div className="divide-y">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-muted-foreground font-mono w-8">#{order.id}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{order.client}</p>
                    <p className="text-xs text-muted-foreground truncate">{order.device} · {order.issue}</p>
                  </div>
                </div>
                <StatusBadge status={order.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-4 md:space-y-6">
          {/* Profit */}
          <div className="stat-card">
            <p className="text-xs text-muted-foreground mb-1">Lucro Líquido do Mês</p>
            <p className="text-2xl font-semibold text-success tracking-tight">R$ 2.140</p>
            <div className="mt-3 pt-3 border-t space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Receita</span>
                <span className="font-medium">R$ 4.280</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Custos</span>
                <span className="font-medium">R$ 2.140</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Margem</span>
                <span className="font-medium text-success">50%</span>
              </div>
            </div>
          </div>

          {/* Low stock */}
          <div className="stat-card border-warning/20">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <p className="text-xs font-medium">Estoque Baixo</p>
            </div>
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div key={item.item} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.item}</span>
                  <span className="font-medium text-destructive">{item.qty}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
