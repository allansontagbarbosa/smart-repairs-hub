export type TipoPrejuizo =
  | "garantia"
  | "peca_danificada"
  | "cliente_sumiu"
  | "fraude_chargeback"
  | "furto_extravio"
  | "cancelamento_com_peca"
  | "outro";

export type OrigemPrejuizo =
  | "manual"
  | "automatico_garantia"
  | "automatico_cancelamento";

export interface OSResumo {
  id: string;
  numero: number;
  numero_formatado: string | null;
}

export interface Prejuizo {
  id: string;
  tipo: TipoPrejuizo;
  tipo_label: string;
  valor_centavos: number;
  descricao: string | null;
  observacoes: string | null;
  data_evento: string;
  origem: OrigemPrejuizo;
  created_at: string;
  created_by_nome: string | null;
  os_origem: OSResumo | null;
  os_retrabalho: OSResumo | null;
  movimentacao_financeira_id: string | null;
}

export interface PrejuizoTipoAgrupado {
  tipo: TipoPrejuizo;
  tipo_label: string;
  qtd: number;
  total_centavos: number;
}

export interface PrejuizoResumoPeriodo {
  periodo: { inicio: string; fim: string; total_centavos: number; qtd: number };
  periodo_anterior: { inicio: string; fim: string; total_centavos: number; qtd: number };
  variacao_pct: number | null;
}

export const TIPO_PREJUIZO_LABELS: Record<TipoPrejuizo, string> = {
  garantia: "Garantia",
  peca_danificada: "Peça danificada",
  cliente_sumiu: "Cliente sumiu",
  fraude_chargeback: "Fraude/Chargeback",
  furto_extravio: "Furto/Extravio",
  cancelamento_com_peca: "Cancelamento com peça",
  outro: "Outro",
};

export const TIPO_PREJUIZO_COR: Record<TipoPrejuizo, string> = {
  garantia: "bg-orange-100 text-orange-700 border-orange-200",
  peca_danificada: "bg-red-100 text-red-700 border-red-200",
  cliente_sumiu: "bg-purple-100 text-purple-700 border-purple-200",
  fraude_chargeback: "bg-rose-100 text-rose-700 border-rose-200",
  furto_extravio: "bg-pink-100 text-pink-700 border-pink-200",
  cancelamento_com_peca: "bg-amber-100 text-amber-700 border-amber-200",
  outro: "bg-gray-100 text-gray-700 border-gray-200",
};
