import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { addDays, startOfDay, startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PeriodRange } from "@/components/dashboard/period-presets";

export type ContaPagar = {
  id: string;
  descricao: string;
  categoria: string;
  categoria_financeira_id: string | null;
  centro_custo: string | null;
  centro_custo_id: string | null;
  fornecedor: string | null;
  fornecedor_id: string | null;
  loja_id: string | null;
  ordem_servico_id: string | null;
  valor: number;
  data_vencimento: string;
  mes_competencia: string | null;
  data_pagamento: string | null;
  status: "pendente" | "paga" | "vencida" | "cancelada";
  recorrente: boolean;
  observacoes: string | null;
  created_at: string;
  lojas?: { nome: string } | null;
  fornecedores?: { nome: string } | null;
  ordens_de_servico?: { numero: number } | null;
};

export type Comissao = {
  id: string;
  funcionario_id: string;
  ordem_id: string | null;
  os_servico_id: string | null;
  tipo: string | null;
  valor_base: number | null;
  valor: number;
  status: "pendente" | "liberada" | "paga" | "estornada";
  data_pagamento: string | null;
  estornada_em: string | null;
  observacoes: string | null;
  created_at: string;
  funcionarios?: { nome: string } | null;
  ordens_de_servico?: {
    numero: number;
    numero_formatado: string | null;
    status?: string | null;
    data_conclusao?: string | null;
    aparelhos?: {
      marca: string;
      modelo: string;
      clientes?: { nome: string } | null;
    } | null;
  } | null;
  os_servicos?: { nome: string; status: string } | null;
};

export type PrejuizoFinanceiro = {
  id: string;
  tipo: string;
  valor_centavos: number;
  data_evento: string;
  origem: string;
  movimentacao_financeira_id: string | null;
};

async function fetchPrejuizos() {
  const { data, error } = await supabase
    .from("prejuizos")
    .select("id, tipo, valor_centavos, data_evento, origem, movimentacao_financeira_id")
    .is("deleted_at", null)
    .order("data_evento", { ascending: false });
  if (error) {
    console.error("ERRO fetchPrejuizos:", error.code, error.message);
    throw error;
  }
  return (data ?? []) as PrejuizoFinanceiro[];
}

async function fetchContas() {
  const { data, error } = await supabase
    .from("contas_a_pagar")
    .select("*, lojas ( nome ), fornecedores ( nome ), ordens_de_servico ( numero )")
    .is("deleted_at", null)
    .order("data_vencimento", { ascending: true });
  if (error) {
    console.error("ERRO fetchContas:", error.code, error.message, error.details);
    throw error;
  }
  return (data ?? []) as ContaPagar[];
}

async function fetchComissoes() {
  const { data, error } = await supabase
    .from("comissoes")
    .select(`*,
      funcionarios ( nome ),
      ordens_de_servico ( numero, numero_formatado, status, data_conclusao, aparelhos ( marca, modelo, clientes ( nome ) ) ),
      os_servicos ( nome, status )
    `)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("ERRO fetchComissoes:", error.code, error.message, error.details);
    throw error;
  }
  return (data ?? []) as Comissao[];
}

async function fetchCategoriasFinanceiras() {
  const { data, error } = await supabase
    .from("categorias_financeiras")
    .select("*")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return data ?? [];
}

async function fetchCentrosCusto() {
  const { data, error } = await supabase
    .from("centros_custo")
    .select("*")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return data ?? [];
}

async function fetchFuncionarios() {
  const { data, error } = await supabase
    .from("funcionarios")
    .select("id, nome, tipo_comissao, valor_comissao")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return data ?? [];
}

async function fetchOrdens() {
  const { data, error } = await supabase
    .from("ordens_de_servico")
    .select("id, numero, valor, valor_total, custo_pecas, status, data_entrada, data_conclusao, aparelhos ( marca, modelo, clientes ( nome ) )")
    .neq("status", "cancelado")
    .is("deleted_at", null)
    .order("data_entrada", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function fetchRecebimentos() {
  const { data, error } = await supabase
    .from("movimentacoes_financeiras")
    .select("*")
    .eq("tipo", "entrada")
    .is("estornada_em", null)
    .order("data", { ascending: false });
  if (error) {
    console.error("ERRO fetchRecebimentos:", error.code, error.message, error.details);
    throw error;
  }
  return (data ?? []).map((m: any) => ({
    id: m.id,
    descricao: m.descricao,
    valor: Number(m.valor ?? 0),
    data_recebimento: m.data,
    // forma_pagamento real (pix, dinheiro, cartao_debito, etc.) vem da coluna do banco.
    // Origem da entrada (OS vs avulso) fica em `origem`, separada da forma de pagamento.
    forma_pagamento: m.forma_pagamento ?? null,
    // Origem refinada:
    // - "os": entrada vinculada a uma OS (ordem_id preenchido).
    // - "pagamento_cliente": pagamento de saldo devedor (não é receita nova, já
    //   contabilizada na OS original). Não somar em "Recebimentos extras".
    // - "avulso": demais entradas (vendas avulsas, devoluções, etc.) — receita
    //   genuína do período.
    origem: (m.ordem_id
      ? "os"
      : m.categoria === "recebimento_cliente"
        ? "pagamento_cliente"
        : "avulso") as "os" | "pagamento_cliente" | "avulso",
    categoria: m.categoria ?? null,
    ordem_servico_id: m.ordem_id,
    cliente_id: m.cliente_id ?? null,
    loja_id: null,
    observacoes: m.estoque_id ? "Entrada vinculada ao estoque" : null,
    created_at: m.created_at,
  }));
}

async function fetchFornecedores() {
  const { data, error } = await supabase
    .from("fornecedores")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return data ?? [];
}

async function fetchLojas() {
  const { data, error } = await supabase
    .from("lojas")
    .select("id, nome, cliente_id, clientes ( nome )")
    .eq("ativo", true)
    .is("deleted_at", null)
    .order("nome");
  if (error) throw error;
  return data ?? [];
}

const formatCompetencia = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

interface UseFinanceiroOptions {
  /**
   * Range opcional para os KPIs de movimentação no período.
   * Quando não informado, usa o mês corrente. KPIs de carteira (vencidas,
   * próximos vencimentos, total pendente) IGNORAM esse range.
   */
  periodRange?: PeriodRange;
}

export function useFinanceiro(options: UseFinanceiroOptions = {}) {
  const contas = useQuery({ queryKey: ["contas_pagar"], queryFn: fetchContas });
  const comissoes = useQuery({ queryKey: ["comissoes"], queryFn: fetchComissoes });
  const categorias = useQuery({ queryKey: ["categorias_financeiras"], queryFn: fetchCategoriasFinanceiras });
  const centros = useQuery({ queryKey: ["centros_custo"], queryFn: fetchCentrosCusto });
  const funcionarios = useQuery({ queryKey: ["funcionarios_fin"], queryFn: fetchFuncionarios });
  const ordens = useQuery({ queryKey: ["ordens_fin"], queryFn: fetchOrdens });
  const fornecedores = useQuery({ queryKey: ["fornecedores_fin"], queryFn: fetchFornecedores });
  const lojas = useQuery({ queryKey: ["lojas_fin"], queryFn: fetchLojas });
  const recebimentos = useQuery({ queryKey: ["recebimentos"], queryFn: fetchRecebimentos });
  const prejuizos = useQuery({ queryKey: ["prejuizos_fin"], queryFn: fetchPrejuizos });

  const isLoading = contas.isLoading || comissoes.isLoading || ordens.isLoading;

  const kpis = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const next7DaysEnd = addDays(todayStart, 7);
    const next30DaysEnd = addDays(todayStart, 30);

    // Range de movimentação: usa o filtro, senão mês corrente.
    const periodStart = options.periodRange?.from ?? startOfMonth(now);
    const periodEnd = options.periodRange?.to ?? endOfMonth(now);

    // Lista de meses de competência cobertos pelo range.
    const competenciasNoRange: string[] = [];
    {
      const cursor = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
      const last = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);
      while (cursor <= last) {
        competenciasNoRange.push(formatCompetencia(cursor));
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    const allContas = contas.data ?? [];
    const allComissoes = comissoes.data ?? [];
    const allOrdens = ordens.data ?? [];
    const allRecebimentos = recebimentos.data ?? [];
    const allPrejuizos = prejuizos.data ?? [];

    const TIPOS_OPERACIONAIS = ["garantia", "peca_danificada", "cancelamento_com_peca"];
    const TIPOS_NAO_OPERACIONAIS = ["cliente_sumiu", "fraude_chargeback", "furto_extravio", "outro"];

    const prejuizosOpMes = allPrejuizos
      .filter(p => {
        const d = new Date(p.data_evento + "T12:00:00");
        return d >= periodStart && d <= periodEnd && TIPOS_OPERACIONAIS.includes(p.tipo);
      })
      .reduce((s, p) => s + (p.valor_centavos / 100), 0);

    const prejuizosNaoOpMes = allPrejuizos
      .filter(p => {
        const d = new Date(p.data_evento + "T12:00:00");
        return d >= periodStart && d <= periodEnd && TIPOS_NAO_OPERACIONAIS.includes(p.tipo);
      })
      .reduce((s, p) => s + (p.valor_centavos / 100), 0);

    const totalPrejuizosMes = prejuizosOpMes + prejuizosNaoOpMes;

    // Contas a pagar — buckets DISJUNTOS pra UI não confundir
    const contasPendentes = allContas.filter(c => c.status === "pendente" || c.status === "vencida");

    const tomorrowStart = addDays(todayStart, 1);
    const next7DaysExclusive = addDays(todayStart, 7);   // limite superior inclusive p/ próximos 7
    const next30DaysExclusive = addDays(todayStart, 30); // limite superior inclusive p/ próximos 30

    const vencidas = contasPendentes.filter(c => new Date(c.data_vencimento + "T12:00:00") < todayStart);
    const vencidasTotal = vencidas.reduce((s, c) => s + Number(c.valor), 0);

    const venceHoje = contasPendentes.filter(c => {
      const d = new Date(c.data_vencimento + "T12:00:00");
      return d >= todayStart && d < tomorrowStart;
    }).reduce((s, c) => s + Number(c.valor), 0);

    // Disjunto: AMANHÃ até dia +7
    const venceEm7Dias = contasPendentes.filter(c => {
      const d = new Date(c.data_vencimento + "T12:00:00");
      return d >= tomorrowStart && d <= next7DaysExclusive;
    }).reduce((s, c) => s + Number(c.valor), 0);

    // Disjunto: dia +8 até dia +30
    const venceEm30Dias = contasPendentes.filter(c => {
      const d = new Date(c.data_vencimento + "T12:00:00");
      return d > next7DaysExclusive && d <= next30DaysExclusive;
    }).reduce((s, c) => s + Number(c.valor), 0);

    const totalPendente = contasPendentes.reduce((s, c) => s + Number(c.valor), 0);

    const pagoMes = allContas.filter(c => {
      if (c.status !== "paga" || !c.data_pagamento) return false;
      const d = new Date(c.data_pagamento + "T12:00:00");
      return d >= periodStart && d <= periodEnd;
    }).reduce((s, c) => s + Number(c.valor), 0);

    // Comissões
    const comissoesPendentes = allComissoes.filter(c => c.status === "pendente" || c.status === "liberada");
    const totalComissoesPendentes = comissoesPendentes.reduce((s, c) => s + Number(c.valor), 0);

    // Comissões do mês — REGIME DE COMPETÊNCIA pela data_conclusao da OS.
    const comissoesMes = allComissoes.filter(c => {
      if (c.status !== "pendente" && c.status !== "liberada" && c.status !== "paga") return false;
      if (c.estornada_em) return false;
      const os = c.ordens_de_servico;
      if (!os || !os.data_conclusao) return false;
      if (os.status !== "pronto" && os.status !== "entregue") return false;
      const d = new Date(os.data_conclusao);
      return d >= periodStart && d <= periodEnd;
    }).reduce((s, c) => s + Number(c.valor), 0);

    // Receita REALIZADA no período
    const ordensConcluidasMes = (allOrdens as any[]).filter(o => {
      if (o.status !== "pronto" && o.status !== "entregue") return false;
      const ref = o.data_conclusao ?? null;
      if (!ref) return false;
      const d = new Date(ref);
      return d >= periodStart && d <= periodEnd;
    });
    const receitaMes = ordensConcluidasMes.reduce((s, o: any) => s + Number(o.valor_total ?? o.valor ?? 0), 0);
    const custosPecasMes = ordensConcluidasMes.reduce((s, o) => s + Number(o.custo_pecas ?? 0), 0);

    // Despesas por competência cobertas pelo range
    const despesasMes = allContas.filter(c => {
      return c.mes_competencia ? competenciasNoRange.includes(c.mes_competencia) : false;
    }).reduce((s, c) => s + Number(c.valor), 0);

    // Recebimentos extras no período: APENAS entradas avulsas genuínas.
    // Excluídos:
    // - r.ordem_servico_id → já contam em receitaMes (regime competência)
    // - r.origem === "pagamento_cliente" → pagamento de saldo devedor; receita
    //   já contabilizada quando a OS original foi concluída. Somar aqui inflaria
    //   o "Lucro estimado" duplicando dinheiro já contado.
    const recebimentosMes = allRecebimentos.filter(r => {
      if (r.ordem_servico_id) return false;
      if (r.origem === "pagamento_cliente") return false;
      const d = new Date(r.data_recebimento.includes("T") ? r.data_recebimento : r.data_recebimento + "T12:00:00");
      return d >= periodStart && d <= periodEnd;
    }).reduce((s, r) => s + Number(r.valor), 0);

    // Lucro REAL
    const lucroReal = receitaMes + recebimentosMes - custosPecasMes - despesasMes - comissoesMes - totalPrejuizosMes;

    // Despesas por categoria — competências no range
    const despesasPorCategoria: Record<string, number> = {};
    allContas
      .filter(c => {
        return c.mes_competencia ? competenciasNoRange.includes(c.mes_competencia) : false;
      })
      .forEach(c => {
        const cat = c.categoria || "Outros";
        despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + Number(c.valor);
      });

    // Evolução mensal (últimos 6 meses)
    const evolucaoMensal: { mes: string; despesas: number; receita: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ms = startOfMonth(d);
      const me = endOfMonth(d);
      const label = format(d, "MMM", { locale: ptBR });
      const competencia = formatCompetencia(d);

      const desp = allContas
        .filter(c => {
          return c.mes_competencia === competencia;
        })
        .reduce((s, c) => s + Number(c.valor), 0);

      const rec = (allOrdens as any[])
        .filter(o => {
          if (o.status !== "pronto" && o.status !== "entregue") return false;
          const ref = o.data_conclusao ?? null;
          if (!ref) return false;
          const dd = new Date(ref);
          return dd >= ms && dd <= me;
        })
        .reduce((s, o: any) => s + Number(o.valor_total ?? o.valor ?? 0), 0);

      evolucaoMensal.push({ mes: label, despesas: desp, receita: rec });
    }

    return {
      vencidasTotal,
      venceHoje,
      venceEm7Dias,
      venceEm30Dias,
      totalPendente,
      pagoMes,
      totalComissoesPendentes,
      comissoesMes,
      lucroReal,
      receitaMes,
      custosPecasMes,
      despesasPagasMes: despesasMes,
      recebimentosMes,
      despesasPorCategoria,
      evolucaoMensal,
      contasVencidas: vencidas.length,
      comissoesPendentesCount: comissoesPendentes.length,
      prejuizosOpMes,
      prejuizosNaoOpMes,
      totalPrejuizosMes,
    };
  }, [contas.data, comissoes.data, ordens.data, recebimentos.data, prejuizos.data, options.periodRange]);

  return {
    contas: contas.data ?? [],
    comissoes: comissoes.data ?? [],
    recebimentos: recebimentos.data ?? [],
    prejuizos: prejuizos.data ?? [],
    categorias: categorias.data ?? [],
    centros: centros.data ?? [],
    funcionarios: funcionarios.data ?? [],
    ordens: ordens.data ?? [],
    fornecedores: fornecedores.data ?? [],
    lojas: lojas.data ?? [],
    isLoading,
    kpis,
    refetchContas: contas.refetch,
    refetchComissoes: comissoes.refetch,
  };
}
