import { Wrench, Package, DollarSign, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

const stats = [
  { label: "Aparelhos em Reparo", value: "12", icon: Wrench, trend: "+3 hoje" },
  { label: "Prontos p/ Retirada", value: "5", icon: AlertTriangle, trend: "2 há mais de 3 dias" },
  { label: "Receita do Mês", value: "R$ 4.280", icon: DollarSign, trend: "+18%" },
  { label: "Clientes Ativos", value: "38", icon: Users, trend: "+5 este mês" },
];

const recentOrders = [
  { id: "001", client: "Maria Silva", device: "iPhone 14", issue: "Tela quebrada", status: "em_reparo" as const },
  { id: "002", client: "João Santos", device: "Samsung S23", issue: "Bateria", status: "pronto" as const },
  { id: "003", client: "Ana Costa", device: "Motorola G54", issue: "Não liga", status: "aguardando" as const },
  { id: "004", client: "Pedro Lima", device: "iPhone 13", issue: "Troca de tela", status: "entregue" as const },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral da assistência</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <stat.icon className="h-5 w-5 text-muted-foreground" />
              <TrendingUp className="h-3.5 w-3.5 text-success" />
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            <p className="text-xs text-success mt-1">{stat.trend}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border">
        <div className="p-5 border-b">
          <h2 className="font-semibold">Últimas Ordens de Serviço</h2>
        </div>
        <div className="divide-y">
          {recentOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-xs text-muted-foreground font-mono">#{order.id}</span>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{order.client}</p>
                  <p className="text-xs text-muted-foreground truncate">{order.device} — {order.issue}</p>
                </div>
              </div>
              <StatusBadge status={order.status} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-3">Estoque Baixo</h3>
          <div className="space-y-2">
            {[
              { item: "Tela iPhone 14", qty: 2 },
              { item: "Bateria Samsung S23", qty: 1 },
              { item: "Conector de carga USB-C", qty: 3 },
            ].map((item) => (
              <div key={item.item} className="flex justify-between text-sm">
                <span>{item.item}</span>
                <span className="text-destructive font-medium">{item.qty} un.</span>
              </div>
            ))}
          </div>
        </div>
        <div className="stat-card">
          <h3 className="font-semibold text-sm mb-3">Lucro Líquido do Mês</h3>
          <p className="text-3xl font-bold text-success">R$ 2.140</p>
          <p className="text-xs text-muted-foreground mt-1">Receita R$ 4.280 — Custos R$ 2.140</p>
        </div>
      </div>
    </div>
  );
}
