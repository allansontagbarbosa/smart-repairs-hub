import {
  FileBarChart,
  DollarSign,
  Users,
  Package,
  TrendingUp,
  ArrowLeftRight,
  CreditCard,
  Phone,
  BarChart3,
  Eye,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const RELATORIOS = [
  { id: "dre", icon: FileBarChart, title: "DRE", desc: "Demonstrativo do resultado do exercício" },
  { id: "vendas-pagto", icon: DollarSign, title: "Vendas por forma de pagto", desc: "Pix, dinheiro, cartão, crediário" },
  { id: "vendas-vendedor", icon: Users, title: "Vendas por vendedor", desc: "Performance individual" },
  { id: "giro-estoque", icon: Package, title: "Giro de estoque", desc: "Identifica ruptura e parados" },
  { id: "margem-modelo", icon: TrendingUp, title: "Margem por modelo", desc: "Identifica vencedores" },
  { id: "trade-ins", icon: ArrowLeftRight, title: "Trade-ins", desc: "Conversão em venda" },
  { id: "crediario-ativo", icon: CreditCard, title: "Crediário ativo", desc: "Carteira + atrasos" },
  { id: "cobranca", icon: Phone, title: "Cobrança", desc: "Acompanha cobranças e contatos" },
  { id: "comparativo", icon: BarChart3, title: "Comparativo de períodos", desc: "Mês a mês" },
];

export default function LojaRelatorios() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Relatórios Loja</h1>
        <p className="text-sm text-muted-foreground mt-1">Visualize e exporte em CSV ou PDF</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {RELATORIOS.map((r) => {
          const Icon = r.icon;
          return (
            <div
              key={r.id}
              className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold leading-tight">{r.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-auto">
                <Button variant="outline" size="sm" className="flex-1">
                  <Eye className="h-4 w-4 mr-2" />
                  Visualizar
                </Button>
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
