import { useEffect } from "react";

/**
 * Valida invariantes matemáticas do Painel do Sócio em runtime.
 * Se alguma fórmula quebrar (LL, distribuível, fechamento previsto, etc.),
 * grita no console.error com detalhes. Complementa os testes SQL
 * em public.test_painel_socio_invariantes().
 */
export function useValidaPainel(data: any) {
  useEffect(() => {
    if (!data?.mes_atual || !data?.socio) return;

    const m = data.mes_atual;
    const pct = (data.socio.percentual ?? 0) / 100;
    const reservaPct = (m.reserva_pct ?? 0) / 100;
    const tol = 1.0;

    const checks = [
      {
        nome: "LL = Fat - Peca - Com - Terc - Desp",
        esperado:
          m.faturamento -
          m.custo_pecas -
          m.comissoes -
          (m.custo_terceirizado || 0) -
          m.despesas,
        real: m.lucro_liquido,
      },
      {
        nome: "Distribuivel = max(LL,0) × (1 - reserva%)",
        esperado: Math.max(m.lucro_liquido, 0) * (1 - reservaPct),
        real: m.distribuivel,
      },
      {
        nome: "Meu_parcial = Distrib × meu_pct",
        esperado: m.distribuivel * pct,
        real: m.meu_valor_parcial,
      },
      {
        nome: "LL_prev = Fat_prev - Peca_prev - Com_prev - Terc_prev - Desp",
        esperado:
          m.faturamento_previsto -
          m.custo_pecas_previsto -
          m.comissoes_previstas -
          (m.custo_terceirizado_previsto || 0) -
          m.despesas,
        real: m.lucro_liquido_previsto,
      },
      {
        nome: "Distrib_prev = max(LL_prev,0) × (1 - reserva%)",
        esperado: Math.max(m.lucro_liquido_previsto, 0) * (1 - reservaPct),
        real: m.distribuivel_previsto,
      },
      {
        nome: "Fechamento_previsto = Distrib_prev × meu_pct",
        esperado: m.distribuivel_previsto * pct,
        real: m.fechamento_previsto,
      },
    ];

    for (const c of checks) {
      if (Math.abs(c.esperado - c.real) > tol) {
        // eslint-disable-next-line no-console
        console.error(`[PainelSocio] INVARIANTE QUEBRADA: ${c.nome}`, {
          esperado: c.esperado.toFixed(2),
          real: Number(c.real).toFixed(2),
          diff: (c.esperado - c.real).toFixed(2),
        });
      }
    }
  }, [data]);
}
