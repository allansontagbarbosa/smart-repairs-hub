import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type StatusOrdem = Database["public"]["Enums"]["status_ordem"];
type StatusEstoque = Database["public"]["Enums"]["status_estoque_aparelho"];

/**
 * Maps service order status → stock device status.
 * Returns null if no stock update is needed for this transition.
 */
function mapOrdemToEstoque(statusOrdem: StatusOrdem): StatusEstoque | null {
  switch (statusOrdem) {
    case "recebido":
    case "em_analise":
    case "aguardando_aprovacao":
    case "em_reparo":
    case "pronto":
      return "em_assistencia";
    case "entregue":
      return null; // device leaves — no stock update (it's the client's device)
    default:
      return null;
  }
}

/**
 * Syncs the stock device status based on the OS device's IMEI.
 * Call after every OS status change.
 */
export async function syncEstoqueFromOrdem(aparelhoId: string, novoStatusOrdem: StatusOrdem) {
  // Get the IMEI from the aparelhos (service) table
  const { data: aparelho } = await supabase
    .from("aparelhos")
    .select("imei")
    .eq("id", aparelhoId)
    .single();

  if (!aparelho?.imei) return; // no IMEI → nothing to sync

  const novoStatusEstoque = mapOrdemToEstoque(novoStatusOrdem);
  if (!novoStatusEstoque) return;

  await supabase
    .from("estoque_aparelhos")
    .update({ status: novoStatusEstoque })
    .eq("imei", aparelho.imei);
}

/**
 * When creating a new OS, mark the matching stock device as "em_assistencia".
 */
export async function marcarEstoqueEmAssistencia(imei: string | null) {
  if (!imei) return;
  await supabase
    .from("estoque_aparelhos")
    .update({ status: "em_assistencia" as StatusEstoque })
    .eq("imei", imei);
}
