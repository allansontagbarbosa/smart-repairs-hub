import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojistaAuth } from "@/hooks/useLojistaAuth";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Clock, CheckCircle2, DollarSign, ShieldCheck, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";

function fmt(v: number | null | undefined) {
  return `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function LojistaDashboard() {
  const { lojistaUser } = useLojistaAuth();
  const lojistaId = lojistaUser?.lojista_id;
  const navigate = useNavigate();

  const { data: ordens = [] } = useQuery({
    queryKey: ["lojista-ordens", lojistaId],
    enabled: !!lojistaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("ordens_de_servico")
        .select("id, numero, status, valor, valor_pago, data_entrada, previsao_entrega, aparelhos(marca, modelo, imei)")
        .eq("lojista_id", lojistaId!)
        .is("deleted_at", null)
        .order("data_entrada", { ascending: false });
      return data ?? [];
    },
  });

  const { data: garantias = [] } = useQuery({
    queryKey: ["lojista-garantias-count", lojistaId],
    enabled: !!lojistaId,
    queryFn: async () => {
      const osIds = ordens.filter(o => o.status === "entregue").map(o => o.id);
      if (!osIds.length) return [];
      const { data } = await supabase
        .from("garantias")
        .select("id")
        .in("ordem_id", osIds)
        .eq("status", "ativa")
        .gte("data_fim", new Date().toISOString().split("T")[0]);
      return data ?? [];
    },
  });

  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const emAssistencia = ordens.filter(o => !["entregue"].includes(o.status)).length;
  const prontos = ordens.filter(o => o.status === "pronto");
  const entreguesMes = ordens.filter(o =>
    o.status === "entregue" && o.data_entrada?.startsWith(mesAtual)
  );
  const gastosMes = entreguesMes.reduce((s, o) => s + (o.valor ?? 0), 0);

  const totalPagoMes = entreguesMes.reduce((s, o) => s + (o.valor_pago ?? 0), 0);
  const totalAbertoMes = entreguesMes.reduce((s, o) => s + ((o.valor ?? 0) - (o.valor_pago ?? 0)), 0);
  const saldoDevedor = ordens
    .filter(o => o.status === "entregue")
    .reduce((s, o) => s + Math.max(0, (o.valor ?? 0) - (o.valor_pago ?? 0)), 0);

  const recentes = ordens.slice(0, 8);

  // Last 6 months chart
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "short" });
    const total = ordens
      .filter(o => o.status === "entregue" && o.data_entrada?.startsWith(key))
      .reduce((s, o) => s + (o.valor ?? 0), 0);
    return { name: label, valor: total };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">
          Olá, {lojistaUser?.lojista?.nome || lojistaUser?.nome}!
        </h1>
        <p className="text-sm text-muted-foreground">Painel de acompanhamento</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={Clock} label="Na assistência" value={emAssistencia} color="text-info" />
        <KpiCard icon={CheckCircle2} label="Prontos p/ retirada" value={prontos.length} color="text-success" />
        <KpiCard icon={DollarSign} label="Gastos no mês" value={fmt(gastosMes)} color="text-warning" />
        <KpiCard icon={ShieldCheck} label="Em garantia" value={garantias.length} color="text-primary" />
      </div>

      {/* OS recentes */}
      <div>
        <h2 className="text-sm font-semibold mb-3">OS recentes</h2>
        <div className="space-y-2">
          {recentes.map((os) => (
            <button
              key={os.id}
              onClick={() => navigate("/lojista/aparelhos")}
              className="w-full rounded-xl border bg-card p-3.5 text-left hover:border-primary/20 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">OS #{String(os.numero).padStart(3, "0")}</span>
                  <span className="text-xs text-muted-foreground">
                    {(os.aparelhos as any)?.marca} {(os.aparelhos as any)?.modelo}
                  </span>
                </div>
                <StatusBadge status={os.status} />
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {(os.aparelhos as any)?.imei && (
                  <span>IMEI …{(os.aparelhos as any).imei.slice(-4)}</span>
                )}
                <span>{new Date(os.data_entrada).toLocaleDateString("pt-BR")}</span>
                <ChevronRight className="h-3.5 w-3.5 ml-auto" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Prontos para retirada */}
      {prontos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Prontos para retirada</h2>
            <button
              onClick={() => navigate("/lojista/aparelhos")}
              className="text-xs text-primary hover:underline"
            >
              Ver todas
            </button>
          </div>
          <div className="space-y-2">
            {prontos.slice(0, 5).map((os) => (
              <div key={os.id} className="rounded-xl border bg-success-muted p-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">OS #{String(os.numero).padStart(3, "0")}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {(os.aparelhos as any)?.marca} {(os.aparelhos as any)?.modelo}
                  </span>
                </div>
                <StatusBadge status="pronto" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart + Saldo side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="text-xs font-semibold mb-3">Gastos - últimos 6 meses</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={50} />
                <Tooltip
                  formatter={(v: number) => fmt(v)}
                  labelFormatter={(l) => l}
                />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-xs font-semibold">Saldo</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pago no mês</span>
              <span className="font-medium text-success">{fmt(totalPagoMes)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Em aberto (mês)</span>
              <span className="font-medium text-warning">{fmt(totalAbertoMes)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-sm">
              <span className="font-medium">Saldo devedor total</span>
              <span className={cn("font-bold", saldoDevedor > 0 ? "text-destructive" : "text-success")}>
                {fmt(saldoDevedor)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string | number; color: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold tracking-tight">{value}</p>
    </div>
  );
}
