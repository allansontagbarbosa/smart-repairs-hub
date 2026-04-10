import { supabase } from "@/integrations/supabase/client";

export type ImeiLookupStatus =
  | "idle"
  | "validating"
  | "loading"
  | "success"
  | "partial_success"
  | "not_found"
  | "duplicate"
  | "error";

export type ImeiLookupResult = {
  status: ImeiLookupStatus;
  source?: "api" | "cache" | "tac_db" | "none";
  marca?: string;
  modelo?: string;
  cor?: string;
  capacidade?: string;
  tipo?: string;
  message?: string;
  duplicate?: { table: string; info: string } | null;
  autoFields: Set<string>;
};

// Validate IMEI using Luhn algorithm (client-side pre-check)
export function isValidImei(imei: string): boolean {
  const digits = imei.replace(/\D/g, "");
  if (digits.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = parseInt(digits[i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

export function extractTac(imei: string): string {
  return imei.replace(/\D/g, "").slice(0, 8);
}

/**
 * Centralized IMEI lookup service.
 * Calls the edge function which handles: API → cache → TAC DB → not found.
 * Also checks for duplicates server-side.
 */
export async function lookupImei(imeiRaw: string): Promise<ImeiLookupResult> {
  const digits = imeiRaw.replace(/\D/g, "");

  // Client-side validation
  if (digits.length !== 15) {
    return { status: "error", message: "IMEI deve ter 15 dígitos", autoFields: new Set() };
  }

  if (!isValidImei(digits)) {
    return { status: "error", message: "IMEI inválido (falha na validação)", autoFields: new Set() };
  }

  try {
    const { data, error } = await supabase.functions.invoke("imei-lookup", {
      body: { imei: digits },
    });

    if (error) {
      console.error("[imei-service] Edge function error:", error);
      return {
        status: "error",
        message: "Erro de comunicação com a API. Tente novamente.",
        autoFields: new Set(),
      };
    }

    if (!data) {
      return { status: "error", message: "Resposta vazia da API", autoFields: new Set() };
    }

    // Handle duplicate
    if (data.duplicate) {
      return {
        status: "duplicate",
        message: data.message || "IMEI já cadastrado",
        duplicate: data.duplicate,
        autoFields: new Set(),
      };
    }

    // Map response
    const autoFields = new Set<string>();
    if (data.marca) autoFields.add("marca");
    if (data.modelo) autoFields.add("modelo");
    if (data.cor) autoFields.add("cor");
    if (data.capacidade) autoFields.add("capacidade");

    const statusMap: Record<string, ImeiLookupStatus> = {
      found: "success",
      partial: "partial_success",
      not_found: "not_found",
      error: "error",
    };

    return {
      status: statusMap[data.status] || "not_found",
      source: data.source,
      marca: data.marca,
      modelo: data.modelo,
      cor: data.cor,
      capacidade: data.capacidade,
      tipo: data.tipo,
      message: data.message,
      duplicate: null,
      autoFields,
    };
  } catch (err) {
    console.error("[imei-service] Network error:", err);
    return {
      status: "error",
      message: "Erro de conexão. Verifique sua internet e tente novamente.",
      autoFields: new Set(),
    };
  }
}

/**
 * Save device data to cache for learning (called after successful manual save).
 */
export async function saveToImeiCache(imei: string, marca: string, modelo: string, cor?: string, capacidade?: string) {
  if (!imei || imei.length < 8 || !marca || !modelo) return;
  const tac = extractTac(imei);
  try {
    await supabase.from("imei_device_cache").upsert({
      tac,
      marca: marca.trim(),
      modelo: modelo.trim(),
      cor: cor?.trim() || null,
      capacidade: capacidade?.trim() || null,
      fonte: "manual",
      vezes_usado: 1,
    }, { onConflict: "tac,marca,modelo" });
  } catch {
    // Silent fail for cache
  }
}
