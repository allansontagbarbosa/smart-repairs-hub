import { useState } from "react";
import {
  DollarSign,
  ArrowDown,
  ArrowUp,
  FileBarChart,
  RefreshCw,
  CreditCard as CardIcon,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";

type Tab = "visao" | "fluxo" | "pagar" | "receber" | "dre" | "conciliacao" | "maquinas";

function EmptyTab({ icon, label, desc }: { icon: JSX.Element; label: string; desc: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 flex flex-col items-center justify-center text-center">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
        {icon}
      </div>
      <h2 className="text-lg font-semibold mb-2">{label}</h2>
      <p className="text-sm text-muted-foreground max-w-md">{desc}</p>
    </div>
  );
}

export default function LojaFinanceiro() {
  const { empresaId } = useEmpresa();
  const [tab, setTab] = useState<Tab>("visao");

  const { data: resumo } = useQuery({
    queryKey: ["loja-financeiro-resumo", empresaId],
    queryFn: async () => {
      const ini = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [vendas, crediarioAtivo] = await Promise.all([
        (supabase as any)
          .from("loja_vendas")
          .select("total")
          .eq("empresa_id", empresaId)
          .eq("status", "pago")
          .gte("created_at", ini)
          .is("deleted_at", null),
        (supabase as any)
          .from("loja_crediario")
          .select("total")
          .eq("empresa_id", empresaId)
          .eq("status", "aberto"),
      ]);
      return {
        faturamentoMes: (vendas.data ?? []).reduce((s: number, v: any) => s + Number(v.total), 0),
        receberCrediario: (crediarioAtivo.data ?? []).reduce(
          (s: number, c: any) => s + Number(c.total),
          0,
        ),
      };
    },
    enabled: !!empresaId,
  });

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Financeiro Loja</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fluxo de caixa, contas, DRE e conciliação · separado do Financeiro Assistência
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de caixa</TabsTrigger>
          <TabsTrigger value="pagar">A pagar</TabsTrigger>
          <TabsTrigger value="receber">A receber</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
          <TabsTrigger value="maquinas">Máquinas</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="mt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground font-medium">FATURAMENTO MÊS</p>
              <p className="text-2xl font-bold mt-1">{formatBRL(resumo?.faturamentoMes ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground font-medium">A RECEBER (CREDIÁRIO)</p>
              <p className="text-2xl font-bold mt-1">{formatBRL(resumo?.receberCrediario ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground font-medium">SALDO BANCO</p>
              <p className="text-2xl font-bold mt-1">{formatBRL(0)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground font-medium">SALDO CAIXA</p>
              <p className="text-2xl font-bold mt-1">{formatBRL(0)}</p>
            </div>
          </div>
          <EmptyTab
            icon={<DollarSign className="h-7 w-7" />}
            label="Gráficos detalhados"
            desc="Próxima fase, quando houver volume de dados pra visualizar."
          />
        </TabsContent>

        <TabsContent value="fluxo" className="mt-6">
          <EmptyTab
            icon={<DollarSign className="h-7 w-7" />}
            label="Fluxo de caixa"
            desc="Entradas e saídas dia a dia."
          />
        </TabsContent>
        <TabsContent value="pagar" className="mt-6">
          <EmptyTab
            icon={<ArrowDown className="h-7 w-7" />}
            label="Contas a pagar"
            desc="Fornecedores, aluguel, energia, salários."
          />
        </TabsContent>
        <TabsContent value="receber" className="mt-6">
          <EmptyTab
            icon={<ArrowUp className="h-7 w-7" />}
            label="Contas a receber"
            desc="Crediário ativo + cheques + repasses cartão."
          />
        </TabsContent>
        <TabsContent value="dre" className="mt-6">
          <EmptyTab
            icon={<FileBarChart className="h-7 w-7" />}
            label="DRE mensal"
            desc="Demonstrativo: receita bruta, custos, despesas, lucro líquido."
          />
        </TabsContent>
        <TabsContent value="conciliacao" className="mt-6">
          <EmptyTab
            icon={<RefreshCw className="h-7 w-7" />}
            label="Conciliação bancária"
            desc="Comparar extrato OFX vs lançamentos do sistema."
          />
        </TabsContent>
        <TabsContent value="maquinas" className="mt-6">
          <EmptyTab
            icon={<CardIcon className="h-7 w-7" />}
            label="Máquinas de cartão"
            desc="Recebimentos por adquirente (Stone/Cielo/PagSeguro) + taxas + D+1/D+30."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
