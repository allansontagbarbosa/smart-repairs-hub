export type TipoVinculo = "clt" | "pj" | "mei" | "diarista" | "freelancer" | "estagiario" | "outro";

export const TIPO_VINCULO_LABELS: Record<TipoVinculo, string> = {
  clt: "CLT",
  pj: "PJ",
  mei: "MEI",
  diarista: "Diarista",
  freelancer: "Freelancer",
  estagiario: "Estagiário",
  outro: "Outro",
};

export type TipoMovimentacaoFunc =
  | "salario" | "comissao" | "vale_transporte" | "vale_alimentacao"
  | "hora_extra" | "falta_descontada" | "bonus" | "adiantamento"
  | "reembolso" | "desconto_diverso" | "outro";

export const TIPO_MOV_LABELS: Record<TipoMovimentacaoFunc, string> = {
  salario: "Salário",
  comissao: "Comissão",
  vale_transporte: "Vale transporte",
  vale_alimentacao: "Vale alimentação",
  hora_extra: "Hora extra",
  falta_descontada: "Falta descontada",
  bonus: "Bônus",
  adiantamento: "Adiantamento",
  reembolso: "Reembolso",
  desconto_diverso: "Desconto",
  outro: "Outro",
};

export type StatusMovimentacao = "pendente" | "pago" | "estornado";

export interface FuncionarioRH {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  tipo_vinculo: TipoVinculo;
  salario_centavos: number | null;
  vt_centavos: number;
  va_centavos: number;
  carga_horaria_semanal: number | null;
  data_admissao: string | null;
  data_demissao: string | null;
  ativo: boolean;
  eh_funcionario_rh: boolean;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  estado: string | null;
  especialidade: string | null;
  pendente_pagamento_centavos: number;
}

export interface MovimentacaoFunc {
  id: string;
  data: string;
  competencia: string;
  tipo: TipoMovimentacaoFunc;
  descricao: string | null;
  valor_centavos: number;
  status: StatusMovimentacao;
  data_pagamento: string | null;
  observacoes: string | null;
}

export interface Holerite {
  funcionario: { id: string; nome: string; cargo: string | null; tipo_vinculo: TipoVinculo };
  competencia: string;
  total_proventos_centavos: number;
  total_descontos_centavos: number;
  liquido_centavos: number;
  horas_trabalhadas: number;
  dias_trabalhados: number;
  faltas: number;
  movimentacoes: MovimentacaoFunc[];
}
