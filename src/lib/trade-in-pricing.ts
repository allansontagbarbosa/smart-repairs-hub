/**
 * Tabela de preços base por modelo (condição "Novo"), em R$.
 * Heurística inicial — ajustável.
 */
const TABELA_BASE: Record<string, number> = {
  "iPhone 16 Pro Max": 9500, "iPhone 16 Pro": 8200, "iPhone 16 Plus": 7000, "iPhone 16": 6000,
  "iPhone 15 Pro Max": 7500, "iPhone 15 Pro": 6500, "iPhone 15 Plus": 5500, "iPhone 15": 4800,
  "iPhone 14 Pro Max": 6000, "iPhone 14 Pro": 5200, "iPhone 14 Plus": 4500, "iPhone 14": 3900,
  "iPhone 13 Pro Max": 4500, "iPhone 13 Pro": 3900, "iPhone 13 mini": 2800, "iPhone 13": 3200,
  "iPhone 12 Pro Max": 3300, "iPhone 12 Pro": 2900, "iPhone 12 mini": 2100, "iPhone 12": 2500,
  "iPhone 11 Pro Max": 2600, "iPhone 11 Pro": 2200, "iPhone 11": 1700,
  "iPhone XS Max": 1500, "iPhone XS": 1300, "iPhone XR": 1200,
  "iPhone SE": 900,
  "Samsung Galaxy S24": 3500, "Samsung Galaxy S23": 2800, "Samsung Galaxy A54": 1200,
  "Xiaomi Redmi Note 13": 900, "Motorola Edge 50": 1500,
};

const COEFICIENTE_CONDICAO: Record<string, number> = {
  novo: 1.0,
  usado_a: 0.80,
  usado_b: 0.65,
  usado_c: 0.45,
  sucata: 0.10,
};

export interface ChecklistItem {
  id: string;
  label: string;
  desconto_pct: number;
}

export const CHECKLIST: ChecklistItem[] = [
  { id: "tela", label: "Tela funciona perfeitamente (sem manchas, riscos profundos, touch ok)", desconto_pct: 20 },
  { id: "bateria", label: "Bateria com saúde acima de 80%", desconto_pct: 15 },
  { id: "carcaca", label: "Carcaça/bordas sem amassados ou empenas", desconto_pct: 8 },
  { id: "cameras", label: "Todas as câmeras tiram foto com nitidez", desconto_pct: 12 },
  { id: "biometria", label: "Face ID / Touch ID funciona", desconto_pct: 8 },
  { id: "wifi_celular", label: "Wi-Fi e dados móveis funcionam", desconto_pct: 15 },
  { id: "audio", label: "Auto-falante, microfone e fone funcionam", desconto_pct: 7 },
  { id: "sensores", label: "Sensor de proximidade, giroscópio, vibração ok", desconto_pct: 5 },
];

export interface AvaliacaoResultado {
  valor_base: number;
  valor_apos_condicao: number;
  descontos_aplicados: { id: string; label: string; valor: number }[];
  valor_descontos_total: number;
  valor_final: number;
}

export function calcularAvaliacao(
  modelo: string,
  capacidade: string,
  condicao: string,
  checksFalhos: string[]
): AvaliacaoResultado {
  const valorBase = TABELA_BASE[modelo] ?? 800;

  let bonusCapacidade = 1.0;
  if (capacidade === "256GB") bonusCapacidade = 1.05;
  else if (capacidade === "512GB") bonusCapacidade = 1.10;
  else if (capacidade === "1TB") bonusCapacidade = 1.15;

  const valorAjustadoCap = valorBase * bonusCapacidade;
  const coef = COEFICIENTE_CONDICAO[condicao] ?? 0.5;
  const valorAposCondicao = Math.round(valorAjustadoCap * coef);

  const descontosAplicados = checksFalhos
    .map((id) => {
      const item = CHECKLIST.find((c) => c.id === id);
      if (!item) return null;
      return {
        id: item.id,
        label: item.label.split(" (")[0],
        valor: Math.round(valorAposCondicao * (item.desconto_pct / 100)),
      };
    })
    .filter(Boolean) as { id: string; label: string; valor: number }[];

  const valorDescontosTotal = descontosAplicados.reduce((s, d) => s + d.valor, 0);
  const valorFinal = Math.max(0, valorAposCondicao - valorDescontosTotal);

  return {
    valor_base: Math.round(valorAjustadoCap),
    valor_apos_condicao: valorAposCondicao,
    descontos_aplicados: descontosAplicados,
    valor_descontos_total: valorDescontosTotal,
    valor_final: valorFinal,
  };
}
