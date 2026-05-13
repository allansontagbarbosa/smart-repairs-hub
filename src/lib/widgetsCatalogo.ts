export type Categoria = 'operacao' | 'vendas' | 'financeiro' | 'alertas' | 'geral';

export interface WidgetMeta {
  id: string;
  icon: string;
  nome: string;
  descricao: string;
  categoria: Categoria;
  defaultW: number;
  defaultH: number;
  minW: number;
  minH: number;
}

export const CATEGORIAS: { id: Categoria; nome: string; icon: string; cor: string }[] = [
  { id: 'operacao',   nome: 'Operação',   icon: '📋', cor: '#3b82f6' },
  { id: 'vendas',     nome: 'Vendas',     icon: '💼', cor: '#8b5cf6' },
  { id: 'financeiro', nome: 'Financeiro', icon: '💰', cor: '#00C896' },
  { id: 'alertas',    nome: 'Alertas',    icon: '⚠️', cor: '#ef4444' },
  { id: 'geral',      nome: 'Geral',      icon: '⚙️', cor: '#64748b' },
];

export const WIDGETS_CATALOGO: WidgetMeta[] = [
  { id: 'kpis_dia',           icon: '📊', nome: 'KPIs do dia',           descricao: 'OSs, faturamento, aparelhos abertos',  categoria: 'operacao',   defaultW: 12, defaultH: 2, minW: 4, minH: 2 },
  { id: 'aparelhos_tecnicos', icon: '📋', nome: 'Aparelhos por técnico', descricao: 'Quantos cada técnico tem em aberto',   categoria: 'operacao',   defaultW: 4,  defaultH: 3, minW: 3, minH: 2 },
  { id: 'ultimas_oss',        icon: '🔔', nome: 'Últimas OSs',           descricao: 'Últimas 5 OSs entregues',              categoria: 'operacao',   defaultW: 4,  defaultH: 3, minW: 3, minH: 2 },
  { id: 'agenda_dia',         icon: '📅', nome: 'Agenda do dia',         descricao: 'OSs com previsão de entrega hoje',     categoria: 'operacao',   defaultW: 4,  defaultH: 3, minW: 3, minH: 2 },
  { id: 'top_defeitos',       icon: '🔧', nome: 'Top defeitos do mês',   descricao: 'Defeitos mais reportados',             categoria: 'operacao',   defaultW: 4,  defaultH: 3, minW: 3, minH: 2 },

  { id: 'podio_tecnicos',     icon: '🏆', nome: 'Pódio dos técnicos',    descricao: 'Top 3 técnicos do mês',                categoria: 'vendas',     defaultW: 4,  defaultH: 3, minW: 3, minH: 2 },
  { id: 'ranking_lojistas',   icon: '🏪', nome: 'Top lojistas (volume)', descricao: 'Top 5 lojistas por qtd de OSs',        categoria: 'vendas',     defaultW: 4,  defaultH: 3, minW: 3, minH: 2 },
  { id: 'ticket_medio',       icon: '💵', nome: 'Ticket médio',          descricao: 'Evolução do ticket médio (6 meses)',   categoria: 'vendas',     defaultW: 6,  defaultH: 3, minW: 4, minH: 2 },

  { id: 'meta_mes',           icon: '🎯', nome: 'Meta do mês',           descricao: 'Progresso vs meta de faturamento',     categoria: 'financeiro', defaultW: 6,  defaultH: 2, minW: 3, minH: 2 },
  { id: 'top_lojistas',       icon: '💳', nome: 'Top lojistas (saldo)',  descricao: 'Top 5 lojistas com saldo a receber',   categoria: 'financeiro', defaultW: 6,  defaultH: 3, minW: 3, minH: 2 },
  { id: 'financeiro_mes',     icon: '💰', nome: 'Financeiro do mês',     descricao: 'Receita / Custos / Lucro',             categoria: 'financeiro', defaultW: 4,  defaultH: 2, minW: 3, minH: 2 },
  { id: 'contas_vencer',      icon: '⏳', nome: 'Contas a vencer',       descricao: 'Contas pendentes próx 7 dias',         categoria: 'financeiro', defaultW: 4,  defaultH: 3, minW: 3, minH: 2 },
  { id: 'graf_semanal',       icon: '📈', nome: 'Gráfico semanal',       descricao: 'Receita últimas 4 semanas',            categoria: 'financeiro', defaultW: 6,  defaultH: 3, minW: 4, minH: 2 },

  { id: 'alertas',            icon: '⏰', nome: 'Atenção necessária',    descricao: 'OSs paradas, aguardando, estoque',     categoria: 'alertas',    defaultW: 4,  defaultH: 3, minW: 3, minH: 2 },
  { id: 'estoque_critico',    icon: '📦', nome: 'Estoque crítico',       descricao: 'Lista de peças abaixo do mínimo',      categoria: 'alertas',    defaultW: 4,  defaultH: 3, minW: 3, minH: 2 },

  { id: 'clima_relogio',      icon: '🌡️', nome: 'Clima + relógio',      descricao: 'Hora atual e clima da cidade',         categoria: 'geral',      defaultW: 3,  defaultH: 2, minW: 2, minH: 2 },
];

export function getWidget(id: string): WidgetMeta | undefined {
  return WIDGETS_CATALOGO.find(w => w.id === id);
}

export function getWidgetsPorCategoria(cat: Categoria): WidgetMeta[] {
  return WIDGETS_CATALOGO.filter(w => w.categoria === cat);
}
