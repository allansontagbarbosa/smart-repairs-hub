import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart, Legend, CartesianGrid,
} from "recharts";

const CORES = ["#00C896", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Props {
  dre: any;
}

export function DREGraficosOffscreen({ dre }: Props) {
  if (!dre) return null;
  const { atual, historico } = dre;

  const distribuicao = [
    { nome: "Peças", valor: atual.custoPecas },
    { nome: "Comissões", valor: atual.comissoes },
    { nome: "Gastos fixos", valor: atual.gastosFixos },
    { nome: "Outros gastos", valor: atual.outrosGastos },
    { nome: "Prejuízos", valor: atual.prejuizosOperacionais },
  ].filter((d) => d.valor > 0);

  const ultimos6 = historico.slice(-6).map((h: any) => ({
    mes: h.competencia.slice(5),
    receita: h.receitaBruta,
    lucro: h.ebitda,
  }));

  const margem6 = historico.slice(-6).map((h: any) => ({
    mes: h.competencia.slice(5),
    margem: h.margemLiquida,
  }));

  const ev12 = historico.map((h: any) => ({
    mes: h.competencia.slice(5),
    receita: h.receitaBruta,
    custos: h.custoPecas + h.comissoes + h.prejuizosOperacionais,
    despesas: h.gastosFixos + h.outrosGastos,
  }));

  const ticket6 = historico.slice(-6).map((h: any) => ({
    mes: h.competencia.slice(5),
    ticket: h.ticketMedio,
    oss: h.qtdOSs,
  }));

  return (
    <div style={{ width: 800, background: "#fff", padding: 16, fontFamily: "Arial, sans-serif" }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>1. Distribuição de Custos e Despesas</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={distribuicao}
              dataKey="valor"
              nameKey="nome"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={(e: any) => `${e.nome}: ${fmt(e.valor)}`}
            >
              {distribuicao.map((_, i) => (
                <Cell key={i} fill={CORES[i % CORES.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => fmt(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>2. Receita vs EBITDA — últimos 6 meses</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={ultimos6}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => fmt(Number(v))} />
            <Legend />
            <Bar dataKey="receita" fill="#00C896" name="Receita" />
            <Bar dataKey="lucro" fill="#3b82f6" name="EBITDA" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>3. Evolução da Margem Líquida (%)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={margem6}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} />
            <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
            <Line type="monotone" dataKey="margem" stroke="#8b5cf6" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>4. Composição Financeira — 12 meses</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={ev12}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => fmt(Number(v))} />
            <Legend />
            <Area type="monotone" dataKey="receita" stackId="1" stroke="#00C896" fill="#00C896" />
            <Area type="monotone" dataKey="custos" stackId="2" stroke="#ef4444" fill="#ef4444" />
            <Area type="monotone" dataKey="despesas" stackId="2" stroke="#f59e0b" fill="#f59e0b" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>5. Ticket médio + Volume de OSs (6 meses)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={ticket6}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis yAxisId="left" tickFormatter={(v) => fmt(v)} />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="right" dataKey="oss" fill="#06b6d4" name="OSs" />
            <Line yAxisId="left" type="monotone" dataKey="ticket" stroke="#00C896" strokeWidth={2} name="Ticket" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
