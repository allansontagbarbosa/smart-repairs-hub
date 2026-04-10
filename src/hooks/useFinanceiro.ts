import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
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
  tipo: string | null;
  valor_base: number | null;
  valor: number;
  status: "pendente" | "liberada" | "paga";
  data_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
  funcionarios?: { nome: string } | null;
  ordens_de_servico?: {
    numero: number;
    valor: number | null;
    aparelhos?: { marca: string; modelo: string } | null;
  } | null;
};

async function fetchContas() {
  const { data, error } = await supabase
    .from("contas_a_pagar")
    .select("*, lojas ( nome ), fornecedores ( nome ), ordens_de_servico ( numero )")
    .order("data_vencimento", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ContaPagar[];
}

async function fetchComissoes() {
  const { data, error } = await supabase
    .from("comissoes")
    .select("*, funcionarios ( nome ), ordens_de_servico ( numero, valor, aparelhos ( marca, modelo ) )")
    .order("created_at", { ascending: false });
  if (error) throw error;
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
    .select("id, numero, valor, custo_pecas, status, data_entrada, aparelhos ( marca, modelo, clientes ( nome ) )")
    .order("data_entrada", { ascending: false });
  if (error) throw error;
  return data ?? [];
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

  const isLoading = contas.isLoading || comissoes.isLoading || ordens.isLoading;

  const kpis = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now, { locale: ptBR });
    const weekEnd = endOfWeek(now, { locale: ptBR });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const allContas = contas.data ?? [];
    const allComissoes = comissoes.data ?? [];
    const allOrdens = ordens.data ?? [];

    // Contas a pagar
    const contasPendentes = allContas.filter(c => c.status === "pendente" || c.status === "vencida");
    const pagarHoje = contasPendentes.filter(c => {
      const d = new Date(c.data_vencimento + "T12:00:00");
      return d >= todayStart && d <= todayEnd;
    }).reduce((s, c) => s + Number(c.valor), 0);

    const pagarSemana = contasPendentes.filter(c => {
      const d = new Date(c.data_vencimento + "T12:00:00");
      return d >= weekStart && d <= weekEnd;
    }).reduce((s, c) => s + Number(c.valor), 0);

    const pagarMes = contasPendentes.filter(c => {
      const d = new Date(c.data_vencimento + "T12:00:00");
      return d >= monthStart && d <= monthEnd;
    }).reduce((s, c) => s + Number(c.valor), 0);

    const pagoMes = allContas.filter(c => {
      if (c.status !== "paga" || !c.data_pagamento) return false;
      const d = new Date(c.data_pagamento + "T12:00:00");
      return d >= monthStart && d <= monthEnd;
    }).reduce((s, c) => s + Number(c.valor), 0);

    const contasVencidas = contasPendentes.filter(c => new Date(c.data_vencimento + "T23:59:59") < todayStart);

    // Comissões
    const comissoesPendentes = allComissoes.filter(c => c.status === "pendente" || c.status === "liberada");
    const totalComissoesPendentes = comissoesPendentes.reduce((s, c) => s + Number(c.valor), 0);

    const comissoesMes = allComissoes.filter(c => {
      const d = new Date(c.created_at);
      return d >= monthStart && d <= monthEnd;
    }).reduce((s, c) => s + Number(c.valor), 0);

    // Receita do mês (ordens concluídas ou entregues)
    const ordensMes = allOrdens.filter(o => {
      const d = new Date(o.data_entrada);
      return d >= monthStart && d <= monthEnd;
    });
    const receitaMes = ordensMes.reduce((s, o) => s + Number(o.valor ?? 0), 0);
    const custosPecasMes = ordensMes.reduce((s, o) => s + Number(o.custo_pecas ?? 0), 0);

    // Despesas pagas no mês
    const despesasPagasMes = allContas.filter(c => {
      if (c.status !== "paga" || !c.data_pagamento) return false;
      const d = new Date(c.data_pagamento + "T12:00:00");
      return d >= monthStart && d <= monthEnd;
    }).reduce((s, c) => s + Number(c.valor), 0);

    // Lucro REAL: receita - custos peças - despesas pagas - comissões do mês
    const lucroReal = receitaMes - custosPecasMes - despesasPagasMes - comissoesMes;

    // Despesas por categoria
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
          if (c.status !== "paga" || !c.data_pagamento) return false;
          const dd = new Date(c.data_pagamento + "T12:00:00");
          return dd >= ms && dd <= me;
        })
        .reduce((s, c) => s + Number(c.valor), 0);

      const rec = allOrdens
        .filter(o => {
          const dd = new Date(o.data_entrada);
          return dd >= ms && dd <= me;
        })
        .reduce((s, o) => s + Number(o.valor ?? 0), 0);

      evolucaoMensal.push({ mes: label, despesas: desp, receita: rec });
    }

    return {
      pagarHoje,
      pagarSemana,
      pagarMes,
      pagoMes,
      totalComissoesPendentes,
      comissoesMes,
      lucroReal,
      receitaMes,
      custosPecasMes,
      despesasPagasMes,
      despesasPorCategoria,
      evolucaoMensal,
      contasVencidas: contasVencidas.length,
      comissoesPendentesCount: comissoesPendentes.length,
    };
  }, [contas.data, comissoes.data, ordens.data]);

  return {
    contas: contas.data ?? [],
    comissoes: comissoes.data ?? [],
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
