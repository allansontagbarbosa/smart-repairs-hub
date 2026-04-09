import { useMemo } from "react";
import type { Database } from "@/integrations/supabase/types";

type Aparelho = Database["public"]["Tables"]["estoque_aparelhos"]["Row"];

export type AlertaEstoque = {
  type: "danger" | "warning" | "info";
  message: string;
};

export function useAlertasEstoque(aparelhos: Aparelho[]) {
  return useMemo(() => {
    const alertas: AlertaEstoque[] = [];

    // IMEI duplicates
    const imeiMap: Record<string, string[]> = {};
    for (const a of aparelhos) {
      if (a.imei) {
        if (!imeiMap[a.imei]) imeiMap[a.imei] = [];
        imeiMap[a.imei].push(`${a.marca} ${a.modelo}`);
      }
    }
    for (const [imei, devices] of Object.entries(imeiMap)) {
      if (devices.length > 1) {
        alertas.push({
          type: "danger",
          message: `IMEI duplicado (${imei}): ${devices.join(", ")}`,
        });
      }
    }

    for (const a of aparelhos) {
      const label = `${a.marca} ${a.modelo}${a.imei ? ` (${a.imei})` : ""}`;

      // No location
      if (!a.localizacao) {
        alertas.push({
          type: "info",
          message: `${label} — sem localização definida`,
        });
      }

      // Available but should be in service (heuristic: status is disponivel but we can't cross-check OS here, so skip)
      // We'll handle the cross-check variant below
    }

    const priority = { danger: 0, warning: 1, info: 2 };
    alertas.sort((a, b) => priority[a.type] - priority[b.type]);

    return alertas;
  }, [aparelhos]);
}

/**
 * Cross-check: finds stock devices marked "disponivel" that have an active OS (not entregue).
 * Call with both datasets.
 */
export function useAlertasEstoqueCruzado(
  aparelhos: Aparelho[],
  ordensAtivas: { aparelhos?: { imei?: string | null } | null }[]
) {
  return useMemo(() => {
    const alertas: AlertaEstoque[] = [];

    // Collect IMEIs from active service orders
    const imeisEmAssistencia = new Set<string>();
    for (const o of ordensAtivas) {
      const imei = o.aparelhos?.imei;
      if (imei) imeisEmAssistencia.add(imei);
    }

    for (const a of aparelhos) {
      if (a.status === "disponivel" && a.imei && imeisEmAssistencia.has(a.imei)) {
        alertas.push({
          type: "warning",
          message: `${a.marca} ${a.modelo} (${a.imei}) marcado como disponível, mas tem OS ativa`,
        });
      }
    }

    return alertas;
  }, [aparelhos, ordensAtivas]);
}
