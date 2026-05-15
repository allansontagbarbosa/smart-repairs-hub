/**
 * Shape real retornado pela RPC `tv_get_painel_data`.
 * Mantém os campos que a função SQL realmente devolve em `dados`.
 * Refletido em 2026-05-15.
 */

export interface TVKpis {
  oss_hoje: number;
  faturamento_hoje: number;
  faturamento_mes: number;
  aparelhos_abertos: number;
  prontos_retirar: number;
}

export interface TVPodioTecnico {
  nome: string;
  oss: number;
  comissao: number | null;
}

export interface TVMeta {
  meta_valor: number;
  atual_valor: number;
  pct: number;
}

export interface TVAparelhoTecnico {
  nome: string;
  qtd: number;
}

export interface TVAlertas {
  prontas_paradas: number;
  aguardando_aprovacao_2dias: number;
  estoque_baixo: number;
}

export interface TVLojistaSaldo {
  nome: string;
  saldo: number;
}

export interface TVRankingLojista {
  nome: string;
  qtd_oss: number;
  faturamento: number;
}

export interface TVEstoqueCritico {
  nome: string;
  quantidade: number;
  minimo: number;
}

export interface TVFinanceiroMes {
  receita: number;
  custos_pecas: number;
  despesas: number;
}

export interface TVUltimaOS {
  numero: string;
  tecnico: string | null;
  valor: number;
  data: string | null;
}

export interface TVAgendaDia {
  numero: string;
  tecnico: string | null;
  previsao: string | null;
  prioridade: string | null;
}

export interface TVContaVencer {
  descricao: string;
  valor: number;
  vencimento: string;
  dias: number;
}

export interface TVGrafSemanal {
  semana: string;
  receita: number;
  oss: number;
}

export interface TVTicketMedio {
  mes: string;
  ticket: number | string;
  oss: number;
}

export interface TVTopDefeito {
  defeito: string;
  qtd: number;
}

export interface TVPainelMeta {
  id: string;
  empresa_id: string;
  nome: string;
  tema: "dark" | "light";
  orientacao: "auto" | "landscape" | "portrait";
  widgets: string[];
  // react-grid-layout items — shape específico da lib
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  layout: any[];
  logo_url: string | null;
  tamanho_fonte: "P" | "M" | "G";
  intervalo_refresh: number;
  empresa_nome: string | null;
  empresa_cidade: string | null;
}

export interface TVDados {
  kpis: TVKpis;
  podio: TVPodioTecnico[];
  meta: TVMeta;
  aparelhos_tecnicos: TVAparelhoTecnico[];
  alertas: TVAlertas;
  top_lojistas: TVLojistaSaldo[];
  estoque_critico: TVEstoqueCritico[];
  financeiro_mes: TVFinanceiroMes;
  ultimas_oss: TVUltimaOS[];
  agenda_dia: TVAgendaDia[];
  contas_vencer: TVContaVencer[];
  graf_semanal: TVGrafSemanal[];
  ranking_lojistas: TVRankingLojista[];
  ticket_medio: TVTicketMedio[];
  top_defeitos: TVTopDefeito[];
  gerado_em: string;
}

export type TVPainelResponse =
  | { success: true; painel: TVPainelMeta; dados: TVDados }
  | { success: false; error: string };

export interface WidgetFontes {
  kpi: string;
  titulo: string;
  base: string;
}
