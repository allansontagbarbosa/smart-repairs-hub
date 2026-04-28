import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { addDays, startOfDay, startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
    aparelhos?: { marca: string; modelo: string } | null;
  } | null;
  os_servicos?: { nome: string; status: string } | null;
};

async function fetchContas() {
  const { data, error } = await supabase
    .from("contas_a_pagar")
    .select("*, lojas ( nome ), fornecedores ( nome ), ordens_de_servico ( numero )")
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
      ordens_de_servico ( numero, numero_formatado, aparelhos ( marca, modelo ) ),
      os_servicos ( nome, status )
    `)
    .is("estornada_em", null)
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
    .select("id, numero, valor, custo_pecas, status, data_entrada, data_conclusao, aparelhos ( marca, modelo, clientes ( nome ) )")
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
    forma_pagamento: m.ordem_id ? "os" : "avulso",
    ordem_servico_id: m.ordem_id,
    cliente_id: null,
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

export function useFinanceiro() {
  const contas = useQuery({ queryKey: ["contas_pagar"], queryFn: fetchContas });
  const comissoes = useQuery({ queryKey: ["comissoes"], queryFn: fetchComissoes });
  const categorias = useQuery({ queryKey: ["categorias_financeiras"], queryFn: fetchCategoriasFinanceiras });
  const centros = useQuery({ queryKey: ["centros_custo"], queryFn: fetchCentrosCusto });
  const funcionarios = useQuery({ queryKey: ["funcionarios_fin"], queryFn: fetchFuncionarios });
  const ordens = useQuery({ queryKey: ["ordens_fin"], queryFn: fetchOrdens });
  const fornecedores = useQuery({ queryKey: ["fornecedores_fin"], queryFn: fetchFornecedores });
  const lojas = useQuery({ queryKey: ["lojas_fin"], queryFn: fetchLojas });
  const recebimentos = useQuery({ queryKey: ["recebimentos"], queryFn: fetchRecebimentos });

  const isLoading = contas.isLoading || comissoes.isLoading || ordens.isLoading;

  const kpis = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const next7DaysEnd = addDays(todayStart, 7);
    const next30DaysEnd = addDays(todayStart, 30);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const allContas = contas.data ?? [];
    const allComissoes = comissoes.data ?? [];
    const allOrdens = ordens.data ?? [];
    const allRecebimentos = recebimentos.data ?? [];

    // Contas a pagar
    const contasPendentes = allContas.filter(c => c.status === "pendente" || c.status === "vencida");
    const vencidas = contasPendentes.filter(c => new Date(c.data_vencimento + "T12:00:00") < todayStart);
    const vencidasTotal = vencidas.reduce((s, c) => s + Number(c.valor), 0);

    const venceHoje = contasPendentes.filter(c => {
      const d = new Date(c.data_vencimento + "T12:00:00");
      return d >= todayStart && d < addDays(todayStart, 1);
    }).reduce((s, c) => s + Number(c.valor), 0);

    const venceEm7Dias = contasPendentes.filter(c => {
      const d = new Date(c.data_vencimento + "T12:00:00");
      return d >= todayStart && d <= next7DaysEnd;
    }).reduce((s, c) => s + Number(c.valor), 0);

    const venceEm30Dias = contasPendentes.filter(c => {
      const d = new Date(c.data_vencimento + "T12:00:00");
      return d >= todayStart && d <= next30DaysEnd;
    }).reduce((s, c) => s + Number(c.valor), 0);

    const totalPendente = contasPendentes.reduce((s, c) => s + Number(c.valor), 0);

    const pagoMes = allContas.filter(c => {
      if (c.status !== "paga" || !c.data_pagamento) return false;
      const d = new Date(c.data_pagamento + "T12:00:00");
      return d >= monthStart && d <= monthEnd;
    }).reduce((s, c) => s + Number(c.valor), 0);

    // Comissões
    const comissoesPendentes = allComissoes.filter(c => c.status === "pendente" || c.status === "liberada");
    const totalComissoesPendentes = comissoesPendentes.reduce((s, c) => s + Number(c.valor), 0);

    // Comissões provisionadas no mês: pendentes, liberadas e pagas, exceto estornadas
    const comissoesMes = allComissoes.filter(c => {
      if (c.status !== "pendente" && c.status !== "liberada" && c.status !== "paga") return false;
      if (c.estornada_em) return false;
      const d = new Date(c.created_at);
      return d >= monthStart && d <= monthEnd;
    }).reduce((s, c) => s + Number(c.valor), 0);

    // Receita REALIZADA no mês: apenas OSs concluídas (pronto/entregue) com data_conclusao no mês
    const ordensConcluidasMes = (allOrdens as any[]).filter(o => {
      if (o.status !== "pronto" && o.status !== "entregue") return false;
      const ref = o.data_conclusao ?? null;
      if (!ref) return false;
      const d = new Date(ref);
      return d >= monthStart && d <= monthEnd;
    });
    const receitaMes = ordensConcluidasMes.reduce((s, o) => s + Number(o.valor ?? 0), 0);
    const custosPecasMes = ordensConcluidasMes.reduce((s, o) => s + Number(o.custo_pecas ?? 0), 0);

    // Despesas reais do mês: contas com vencimento no mês, independente de status
    const despesasMes = allContas.filter(c => {
      const d = new Date(c.data_vencimento + "T12:00:00");
      return d >= monthStart && d <= monthEnd;
    }).reduce((s, c) => s + Number(c.valor), 0);

    // Recebimentos extras do mês: entradas avulsas, sem duplicar receita de OS já contabilizada em receitaMes
    const recebimentosMes = allRecebimentos.filter(r => {
      if (r.ordem_servico_id) return false;
      const d = new Date(r.data_recebimento.includes("T") ? r.data_recebimento : r.data_recebimento + "T12:00:00");
      return d >= monthStart && d <= monthEnd;
    }).reduce((s, r) => s + Number(r.valor), 0);

    // Lucro REAL: receita - custos peças - despesas por vencimento - comissões + recebimentos extras
    const lucroReal = receitaMes + recebimentosMes - custosPecasMes - despesasMes - comissoesMes;

    // Despesas por categoria — contas por data_vencimento, independente de status
    const despesasPorCategoria: Record<string, number> = {};
    allContas
      .filter(c => {
        const d = new Date(c.data_vencimento + "T12:00:00");
        return d >= monthStart && d <= monthEnd;
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

      const desp = allContas
        .filter(c => {
          const dd = new Date(c.data_vencimento + "T12:00:00");
          return dd >= ms && dd <= me;
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
        .reduce((s, o) => s + Number(o.valor ?? 0), 0);

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
    };
  }, [contas.data, comissoes.data, ordens.data, recebimentos.data]);

  return {
    contas: contas.data ?? [],
    comissoes: comissoes.data ?? [],
    recebimentos: recebimentos.data ?? [],
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
