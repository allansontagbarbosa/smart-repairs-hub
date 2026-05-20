import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Printer, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { imprimirDRE } from "@/lib/imprimirDRE";

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

// Formata YYYY-MM-DD a partir de Date local (sem deslocamento de timezone)
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function RelDRE() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());

  const inicio = ymd(new Date(ano, mes, 1));
  const fim = ymd(new Date(ano, mes + 1, 0)); // último dia do mês
  const competencia = `${ano}-${String(mes + 1).padStart(2, "0")}`;

  // Fonte ÚNICA: get_dre_periodo
  const { data: dreRaw, isLoading } = useQuery({
    queryKey: ["rel-dre-canonico", inicio, fim],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_dre_periodo", {
        p_inicio: inicio,
        p_fim: fim,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const { data: socios } = useQuery({
    queryKey: ["rel-dre-socios"],
    queryFn: async () => {
      const { data } = await supabase.from("socios").select("*").eq("ativo", true).order("ordem");
      return data ?? [];
    },
  });

  // Adapta o JSON da RPC pro shape que o componente já usava
  const dre = useMemo(() => {
    const r = dreRaw ?? {};
    const receitas = r.receitas ?? {};
    const deducoes = r.deducoes ?? {};
    const custos = r.custos ?? {};
    const despesas = r.despesas ?? {};
    const resultado = r.resultado ?? {};
    const distrib = r.distribuicao ?? {};
    const partes = (distrib.socios ?? []) as Array<{ id: string; nome: string; percentual: number; valor: number }>;
    return {
      servicosFaturados: Number(receitas.servicos_faturados ?? 0),
      outrosReceb: Number(receitas.outros_recebimentos ?? 0),
      receitaBruta: Number(receitas.bruta ?? 0),
      impostos: Number(deducoes.impostos ?? 0),
      receitaLiquida: Number(deducoes.liquida ?? 0),
      custoPecas: Number(custos.pecas ?? 0),
      comissoesPagas: Number(custos.comissoes ?? 0),
      prejuizosOpTotal: Number(custos.prejuizos ?? 0),
      lucroBruto: Number(custos.lucro_bruto ?? 0),
      gastosFixos: Number(despesas.gastos_fixos ?? 0),
      outrosGastos: Number(despesas.outros ?? 0),
      ebitda: Number(despesas.ebitda ?? 0),
      depreciacao: Number(resultado.depreciacao ?? 0),
      prejuizosNaoOpTotal: 0,
      resultadoNaoOperacional: 0,
      lucroLiquido: Number(resultado.lucro_liquido ?? 0),
      margem: Number(resultado.margem_pct ?? 0),
      reservaPct: Number(distrib.reserva_pct ?? 10),
      reserva: Number(distrib.reserva_valor ?? 0),
      distribSocios: Number(distrib.distribuivel ?? 0),
      partesSocios: partes,
      somaPctSocios: partes.reduce((a, p) => a + Number(p.percentual ?? 0), 0),
    };
  }, [dreRaw]);

  // Chart: últimos 6 meses — chama get_dre_periodo uma vez por mês
  const { data: chartData } = useQuery({
    queryKey: ["rel-dre-chart-canonico", ano, mes],
    queryFn: async () => {
      const results: { mes: string; Receita: number; Gastos: number; Lucro: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        let m = mes - i;
        let y = ano;
        while (m < 0) { m += 12; y--; }
        const ini = ymd(new Date(y, m, 1));
        const fi = ymd(new Date(y, m + 1, 0));
        const { data } = await (supabase as any).rpc("get_dre_periodo", {
          p_inicio: ini,
          p_fim: fi,
        });
        const r = data ?? {};
        const receita = Number(r?.receitas?.bruta ?? 0);
        const lucro = Number(r?.resultado?.lucro_liquido ?? 0);
        const gastos = receita - lucro;
        results.push({ mes: meses[m].substring(0, 3), Receita: receita, Gastos: gastos, Lucro: lucro });
      }
      return results;
    },
  });

  const prev = () => { if (mes === 0) { setMes(11); setAno(ano - 1); } else setMes(mes - 1); };
  const next = () => { if (mes === 11) { setMes(0); setAno(ano + 1); } else setMes(mes + 1); };

  const { data: empresaInfo } = useQuery({
    queryKey: ["rel-dre-empresa-info"],
    queryFn: async () => {
      const { data } = await supabase.from("empresas").select("nome,cnpj").limit(1).maybeSingle();
      return data;
    },
  });

  const handleImprimir = () => {
    const graficosEl = document.querySelector(".dre-charts-print");
    const graficosHTML = graficosEl ? graficosEl.innerHTML : "";
    imprimirDRE({
      empresa: {
        nome: empresaInfo?.nome ?? "Ditt Software",
        cnpj: empresaInfo?.cnpj ?? undefined,
      },
      competencia,
      dre,
      socios: socios ?? [],
      graficosHTML,
    });
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Period nav */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="font-semibold text-lg min-w-[180px] text-center">{meses[mes]} {ano}</span>
        <Button variant="outline" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
        <div className="ml-auto flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handleImprimir}>
            <Printer className="h-4 w-4 mr-1" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {/* DRE Card */}
      <Card className="print:shadow-none print:border-none">
        <CardHeader><CardTitle>Demonstrativo de Resultado — {meses[mes]} {ano}</CardTitle></CardHeader>
        <CardContent className="font-mono text-sm space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
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
                {dre.prejuizosOpTotal > 0 && (
                  <LinhaItem label="Prejuízos" valor={dre.prejuizosOpTotal} negativo />
                )}
                <LinhaItem label="= Lucro Bruto" valor={dre.lucroBruto} bold />
              </div>
              <div>
                <p className="font-bold text-muted-foreground mb-1">DESPESAS OPERACIONAIS</p>
                <LinhaItem label="Gastos fixos" valor={dre.gastosFixos} negativo />
                <LinhaItem label="Outros gastos" valor={dre.outrosGastos} negativo />
                <LinhaItem label="= EBITDA" valor={dre.ebitda} bold />
              </div>
              <div className="border-t pt-3">
                <p className="font-bold text-muted-foreground mb-1">RESULTADO</p>
                <LinhaItem label="Depreciação estimada" valor={dre.depreciacao} negativo />
                <LinhaItem label="= Lucro Líquido" valor={dre.lucroLiquido} bold />
                <div className="flex justify-between py-0.5 font-bold">
                  <span>= Margem Líquida</span>
                  <span>{dre.margem.toFixed(1)}%</span>
                </div>
              </div>
              {dre.partesSocios.length > 0 && dre.lucroLiquido > 0 && (
                <div className="border-t pt-3">
                  <p className="font-bold text-muted-foreground mb-1">DISTRIBUIÇÃO</p>
                  <LinhaItem label={`Reserva empresa (${dre.reservaPct}%)`} valor={dre.reserva} />
                  {dre.partesSocios.map(p => (
                    <LinhaItem key={p.id} label={`${p.nome} (${Number(p.percentual).toFixed(2)}%)`} valor={Number(p.valor)} />
                  ))}
                  {Math.abs(dre.somaPctSocios - 100) > 0.01 && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      ⚠ Percentuais somam {dre.somaPctSocios.toFixed(2)}%, ajuste em Configurações &gt; Financeiro
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Chart */}
      <div className="dre-charts-print">
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
    </div>
  );
}
