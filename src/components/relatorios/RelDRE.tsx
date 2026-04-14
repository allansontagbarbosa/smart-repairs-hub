import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function LinhaItem({ label, valor, negativo, bold }: { label: string; valor: number; negativo?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 ${bold ? "font-bold" : ""}`}>
      <span>{negativo ? `(-) ${label}` : label}</span>
      <span className={negativo ? "text-destructive" : ""}>{fmt(valor)}</span>
    </div>
  );
}

export function RelDRE() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());

  const inicio = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const nextM = mes === 11 ? 0 : mes + 1;
  const nextY = mes === 11 ? ano + 1 : ano;
  const fim = `${nextY}-${String(nextM + 1).padStart(2, "0")}-01`;

  const { data: ordens } = useQuery({
    queryKey: ["rel-dre-ordens", inicio],
    queryFn: async () => {
      const { data } = await supabase
        .from("ordens_de_servico")
        .select("valor, custo_pecas, status, data_entrada")
        .is("deleted_at", null)
        .gte("data_entrada", inicio)
        .lt("data_entrada", fim);
      return data ?? [];
    },
  });

  const { data: recebimentos } = useQuery({
    queryKey: ["rel-dre-receb", inicio],
    queryFn: async () => {
      const { data } = await supabase
        .from("recebimentos")
        .select("valor")
        .gte("data_recebimento", inicio)
        .lt("data_recebimento", fim);
      return data ?? [];
    },
  });

  const { data: contas } = useQuery({
    queryKey: ["rel-dre-contas", inicio],
    queryFn: async () => {
      const { data } = await supabase
        .from("contas_a_pagar")
        .select("valor, categoria, status")
        .eq("status", "paga")
        .gte("data_pagamento", inicio)
        .lt("data_pagamento", fim);
      return data ?? [];
    },
  });

  const { data: comissoes } = useQuery({
    queryKey: ["rel-dre-comissoes", inicio],
    queryFn: async () => {
      const { data } = await supabase
        .from("comissoes")
        .select("valor, status")
        .gte("created_at", inicio)
        .lt("created_at", fim);
      return data ?? [];
    },
  });

  const { data: ajustes } = useQuery({
    queryKey: ["rel-dre-ajustes", inicio],
    queryFn: async () => {
      const anoMes = `${ano}-${String(mes + 1).padStart(2, "0")}`;
      const { data } = await supabase
        .from("ajustes_mensais")
        .select("valor, tipo")
        .eq("ano_mes", anoMes);
      return data ?? [];
    },
  });

  const { data: socios } = useQuery({
    queryKey: ["rel-dre-socios"],
    queryFn: async () => {
      const { data } = await supabase.from("socios").select("*").eq("ativo", true).order("ordem");
      return data ?? [];
    },
  });

  const { data: empresaConfig } = useQuery({
    queryKey: ["rel-dre-empresa"],
    queryFn: async () => {
      const { data } = await supabase.from("empresa_config").select("percentual_reserva_empresa").limit(1).single();
      return data;
    },
  });

  // Calculate DRE
  const dre = useMemo(() => {
    const servicosFaturados = (ordens ?? [])
      .filter(o => o.status === "entregue")
      .reduce((s, o) => s + (o.valor ?? 0), 0);
    const outrosReceb = (recebimentos ?? []).reduce((s, r) => s + r.valor, 0);
    const receitaBruta = servicosFaturados + outrosReceb;

    const impostos = (ajustes ?? []).filter(a => a.tipo === "impostos").reduce((s, a) => s + a.valor, 0);
    const receitaLiquida = receitaBruta - impostos;

    const custoPecas = (ordens ?? [])
      .filter(o => o.status === "entregue")
      .reduce((s, o) => s + (o.custo_pecas ?? 0), 0);
    const comissoesPagas = (comissoes ?? []).reduce((s, c) => s + c.valor, 0);
    const lucroBruto = receitaLiquida - custoPecas - comissoesPagas;

    const gastosFixos = (contas ?? []).filter(c => c.categoria === "fixo").reduce((s, c) => s + c.valor, 0);
    const depreciacao = (ajustes ?? []).filter(a => a.tipo === "depreciacao").reduce((s, a) => s + a.valor, 0);
    const outrosGastos = (contas ?? []).filter(c => c.categoria !== "fixo").reduce((s, c) => s + c.valor, 0);
    const ebitda = lucroBruto - gastosFixos - depreciacao - outrosGastos;

    const lucroLiquido = ebitda;
    const margem = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

    const reservaPct = empresaConfig?.percentual_reserva_empresa ?? 10;
    const reserva = Math.max(0, lucroLiquido * reservaPct / 100);
    const distribSocios = Math.max(0, lucroLiquido - reserva);
    const porSocio = (socios ?? []).length > 0 ? distribSocios / (socios ?? []).length : 0;

    return {
      servicosFaturados, outrosReceb, receitaBruta,
      impostos, receitaLiquida,
      custoPecas, comissoesPagas, lucroBruto,
      gastosFixos, depreciacao, outrosGastos, ebitda,
      lucroLiquido, margem,
      reservaPct, reserva, porSocio,
    };
  }, [ordens, recebimentos, contas, comissoes, ajustes, socios, empresaConfig]);

  // Last 6 months chart
  const { data: chartData } = useQuery({
    queryKey: ["rel-dre-chart", ano, mes],
    queryFn: async () => {
      const results = [];
      for (let i = 5; i >= 0; i--) {
        let m = mes - i;
        let y = ano;
        while (m < 0) { m += 12; y--; }
        const ini = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        const nm = m === 11 ? 0 : m + 1;
        const ny = m === 11 ? y + 1 : y;
        const fi = `${ny}-${String(nm + 1).padStart(2, "0")}-01`;

        const [{ data: os }, { data: cp }] = await Promise.all([
          supabase.from("ordens_de_servico").select("valor, custo_pecas").is("deleted_at", null).eq("status", "entregue").gte("data_entrada", ini).lt("data_entrada", fi),
          supabase.from("contas_a_pagar").select("valor").eq("status", "paga").gte("data_pagamento", ini).lt("data_pagamento", fi),
        ]);

        const receita = (os ?? []).reduce((s, o) => s + (o.valor ?? 0), 0);
        const gastos = (cp ?? []).reduce((s, c) => s + c.valor, 0) + (os ?? []).reduce((s, o) => s + (o.custo_pecas ?? 0), 0);
        results.push({ mes: meses[m].substring(0, 3), Receita: receita, Gastos: gastos, Lucro: receita - gastos });
      }
      return results;
    },
  });

  const prev = () => { if (mes === 0) { setMes(11); setAno(ano - 1); } else setMes(mes - 1); };
  const next = () => { if (mes === 11) { setMes(0); setAno(ano + 1); } else setMes(mes + 1); };

  return (
    <div className="space-y-6 mt-4">
      {/* Period nav */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="font-semibold text-lg min-w-[180px] text-center">{meses[mes]} {ano}</span>
        <Button variant="outline" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" className="ml-auto print:hidden" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" /> Exportar PDF
        </Button>
      </div>

      {/* DRE Card */}
      <Card className="print:shadow-none print:border-none">
        <CardHeader><CardTitle>Demonstrativo de Resultado — {meses[mes]} {ano}</CardTitle></CardHeader>
        <CardContent className="font-mono text-sm space-y-4">
          <div>
            <p className="font-bold text-muted-foreground mb-1">RECEITAS</p>
            <LinhaItem label="Serviços faturados" valor={dre.servicosFaturados} />
            <LinhaItem label="Outros recebimentos" valor={dre.outrosReceb} />
            <LinhaItem label="= Receita Bruta" valor={dre.receitaBruta} bold />
          </div>
          <div>
            <p className="font-bold text-muted-foreground mb-1">DEDUÇÕES</p>
            <LinhaItem label="Impostos" valor={dre.impostos} negativo />
            <LinhaItem label="= Receita Líquida" valor={dre.receitaLiquida} bold />
          </div>
          <div>
            <p className="font-bold text-muted-foreground mb-1">CUSTOS</p>
            <LinhaItem label="Peças utilizadas" valor={dre.custoPecas} negativo />
            <LinhaItem label="Comissões" valor={dre.comissoesPagas} negativo />
            <LinhaItem label="= Lucro Bruto" valor={dre.lucroBruto} bold />
          </div>
          <div>
            <p className="font-bold text-muted-foreground mb-1">DESPESAS OPERACIONAIS</p>
            <LinhaItem label="Gastos fixos" valor={dre.gastosFixos} negativo />
            <LinhaItem label="Depreciação" valor={dre.depreciacao} negativo />
            <LinhaItem label="Outros gastos" valor={dre.outrosGastos} negativo />
            <LinhaItem label="= EBITDA" valor={dre.ebitda} bold />
          </div>
          <div className="border-t pt-3">
            <p className="font-bold text-muted-foreground mb-1">RESULTADO</p>
            <LinhaItem label="= Lucro Líquido" valor={dre.lucroLiquido} bold />
            <div className="flex justify-between py-0.5 font-bold">
              <span>= Margem Líquida</span>
              <span>{dre.margem.toFixed(1)}%</span>
            </div>
          </div>
          {(socios ?? []).length > 0 && dre.lucroLiquido > 0 && (
            <div className="border-t pt-3">
              <p className="font-bold text-muted-foreground mb-1">DISTRIBUIÇÃO</p>
              <LinhaItem label={`Reserva empresa (${dre.reservaPct}%)`} valor={dre.reserva} />
              {(socios ?? []).map(s => (
                <LinhaItem key={s.id} label={s.nome} valor={dre.porSocio} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart */}
      <Card className="print:hidden">
        <CardHeader><CardTitle>Últimos 6 meses</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="Receita" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
              <Bar dataKey="Gastos" fill="hsl(var(--destructive))" radius={[4,4,0,0]} />
              <Bar dataKey="Lucro" fill="hsl(var(--chart-2))" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
