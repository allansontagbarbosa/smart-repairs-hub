import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, DollarSign, PiggyBank, Percent } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from "recharts";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

type SocioInfo = { id: string; nome: string; percentual: number };

async function fetchMeuSocio(userId: string): Promise<SocioInfo | null> {
  const { data, error } = await supabase
    .from("socios")
    .select("id, nome, percentual_participacao")
    .eq("user_id", userId)
    .eq("ativo", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    nome: data.nome,
    percentual: Number(data.percentual_participacao) || 0,
  };
}

async function fetchEmpresaConfig() {
  const { data, error } = await supabase
    .from("configuracoes")
    .select("percentual_reserva_empresa")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchLucroPeriodo(start: Date, end: Date) {
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const [ordensRes, despesasRes, comissoesRes] = await Promise.all([
    supabase
      .from("ordens_de_servico")
      .select("valor_total, valor, custo_pecas, status, data_conclusao")
      .gte("data_conclusao", startIso)
      .lte("data_conclusao", endIso)
      .in("status", ["pronto", "entregue"]),
    supabase
      .from("contas_a_pagar")
      .select("valor, status, data_pagamento")
      .eq("status", "paga")
      .gte("data_pagamento", startIso)
      .lte("data_pagamento", endIso),
    supabase
      .from("comissoes")
      .select("valor, status, data_pagamento")
      .eq("status", "paga")
      .gte("data_pagamento", startIso)
      .lte("data_pagamento", endIso),
  ]);

  const faturamento = (ordensRes.data ?? []).reduce(
    (s: number, o: any) => s + Number(o.valor_total ?? o.valor ?? 0),
    0,
  );
  const custosPecas = (ordensRes.data ?? []).reduce(
    (s: number, o: any) => s + Number(o.custo_pecas ?? 0),
    0,
  );
  const despesas = (despesasRes.data ?? []).reduce(
    (s: number, d: any) => s + Number(d.valor ?? 0),
    0,
  );
  const comissoes = (comissoesRes.data ?? []).reduce(
    (s: number, c: any) => s + Number(c.valor ?? 0),
    0,
  );

  const ll = faturamento - custosPecas - despesas - comissoes;
  return { faturamento, custosPecas, despesas, comissoes, ll };
}

async function fetchHistorico6Meses() {
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i);
    return {
      start: startOfMonth(d),
      end: endOfMonth(d),
      label: format(d, "MMM/yy", { locale: ptBR }),
    };
  });

  return Promise.all(
    meses.map(async (m) => {
      const { ll } = await fetchLucroPeriodo(m.start, m.end);
      return { mes: m.label, lucro_liquido: ll };
    }),
  );
}

export default function PainelSocio() {
  const { user } = useAuth();

  const hoje = new Date();
  const inicioMes = useMemo(() => startOfMonth(hoje), []);
  const fimMes = useMemo(() => endOfMonth(hoje), []);

  const { data: meuSocio, isLoading: loadingSocio } = useQuery({
    queryKey: ["meu-socio", user?.id],
    queryFn: () => fetchMeuSocio(user!.id),
    enabled: !!user?.id,
  });

  const { data: empresaConfig } = useQuery({
    queryKey: ["painel-socio-config"],
    queryFn: fetchEmpresaConfig,
  });

  const { data: lucroMes, isLoading: loadingLucro } = useQuery({
    queryKey: ["painel-socio-lucro-mes", inicioMes.toISOString()],
    queryFn: () => fetchLucroPeriodo(inicioMes, fimMes),
  });

  const { data: historico } = useQuery({
    queryKey: ["painel-socio-historico"],
    queryFn: fetchHistorico6Meses,
  });

  if (loadingSocio || loadingLucro) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!meuSocio) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Acesso restrito</h1>
        <p className="text-muted-foreground">
          Esta página é exclusiva para sócios cadastrados. Se você acredita que isso é um erro,
          fale com o administrador.
        </p>
      </div>
    );
  }

  const reservaPct = Number(empresaConfig?.percentual_reserva_empresa ?? 20);
  const ll = lucroMes?.ll ?? 0;
  const reservaVal = ll > 0 ? (ll * reservaPct) / 100 : 0;
  const lucroDistrib = ll > 0 ? ll - reservaVal : 0;
  const meuPct = meuSocio.percentual;
  const meuValor = (lucroDistrib * meuPct) / 100;

  const historicoComMeuValor = (historico ?? []).map((h) => ({
    mes: h.mes,
    meu_valor:
      h.lucro_liquido > 0
        ? ((h.lucro_liquido - (h.lucro_liquido * reservaPct) / 100) * meuPct) / 100
        : 0,
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Painel do Sócio</h1>
        <p className="text-muted-foreground mt-1">
          Olá, <span className="font-medium text-foreground">{meuSocio.nome}</span>. Você participa
          com <span className="font-medium text-foreground">{meuPct.toFixed(2)}%</span> da empresa.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Lucro líquido (mês)
              <TrendingUp className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brl(ll)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Faturamento − custos − despesas − comissões
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Reserva da empresa ({reservaPct}%)
              <PiggyBank className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brl(reservaVal)}</div>
            <p className="text-xs text-muted-foreground mt-1">Fica retido para caixa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Distribuível entre sócios
              <DollarSign className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{brl(lucroDistrib)}</div>
            <p className="text-xs text-muted-foreground mt-1">Lucro líquido − reserva</p>
          </CardContent>
        </Card>

        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-primary flex items-center justify-between">
              SEU VALOR ESTE MÊS
              <Percent className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{brl(meuValor)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {meuPct.toFixed(2)}% de {brl(lucroDistrib)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Sua distribuição mensal (últimos 6 meses)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Estimativa baseada no lucro líquido e nos percentuais atuais.
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historicoComMeuValor}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis tickFormatter={(v) => brl(Number(v))} className="text-xs" width={90} />
                <RTooltip
                  formatter={(v: any) => brl(Number(v))}
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Bar dataKey="meu_valor" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detalhamento */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento do mês</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">Faturamento</span>
            <span className="font-medium">{brl(lucroMes?.faturamento ?? 0)}</span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">(−) Custo das peças</span>
            <span className="font-medium">−{brl(lucroMes?.custosPecas ?? 0)}</span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">(−) Despesas pagas</span>
            <span className="font-medium">−{brl(lucroMes?.despesas ?? 0)}</span>
          </div>
          <div className="flex justify-between text-sm py-1 border-b">
            <span className="text-muted-foreground">(−) Comissões pagas</span>
            <span className="font-medium">−{brl(lucroMes?.comissoes ?? 0)}</span>
          </div>
          <div className="flex justify-between text-sm py-1 font-semibold">
            <span>Lucro líquido</span>
            <span>{brl(ll)}</span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">(−) Reserva da empresa ({reservaPct}%)</span>
            <span className="font-medium">−{brl(reservaVal)}</span>
          </div>
          <div className="flex justify-between text-sm py-1 border-b font-semibold">
            <span>Distribuível</span>
            <span>{brl(lucroDistrib)}</span>
          </div>
          <div className="flex justify-between text-base py-2 font-bold text-primary">
            <span>Seu valor ({meuPct.toFixed(2)}%)</span>
            <span>{brl(meuValor)}</span>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center pt-2">
        Valores estimados em tempo real. Distribuição efetiva depende de aprovação contábil.
      </p>
    </div>
  );
}
