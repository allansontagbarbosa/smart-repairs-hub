/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Serviço centralizado de consulta IMEI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este módulo é o ÚNICO ponto de contato entre o frontend e a API de IMEI.
 * Toda a lógica de consulta, mapeamento e cache é delegada à edge function
 * `imei-lookup`, mantendo o frontend desacoplado do provedor de API.
 *
 * ARQUITETURA:
 *   Frontend (este arquivo)
 *     └── supabase.functions.invoke("imei-lookup")
 *           └── Edge Function (supabase/functions/imei-lookup/index.ts)
 *                 ├── API Externa (fonte principal)
 *                 ├── Cache local (imei_device_cache)
 *                 └── Base TAC interna (fallback)
 *
 * PARA TROCAR DE PROVEDOR DE API:
 *   - Edite APENAS a edge function (supabase/functions/imei-lookup/index.ts)
 *   - Este arquivo NÃO precisa mudar — a interface é estável
 *
 * ESTADOS POSSÍVEIS:
 *   idle            → aguardando entrada
 *   validating      → validando formato do IMEI (client-side)
 *   loading         → consultando API via edge function
 *   success         → aparelho identificado com todos os dados
 *   partial_success → aparelho identificado parcialmente
 *   not_found       → IMEI não encontrado em nenhuma fonte
 *   duplicate       → IMEI já cadastrado no sistema
 *   error           → erro de comunicação ou interno
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS EXPORTADOS
// ─────────────────────────────────────────────────────────────────────────────

/** Estados possíveis do fluxo de consulta IMEI */
export type ImeiLookupStatus =
  | "idle"
  | "validating"
  | "loading"
  | "success"
  | "partial_success"
  | "not_found"
  | "duplicate"
  | "error";

/** Resultado padronizado de uma consulta IMEI */
export type ImeiLookupResult = {
  status: ImeiLookupStatus;

  /** Origem dos dados: api (externa), cache (local), tac_db (base interna), none */
  source?: "api" | "cache" | "tac_db" | "none";

  /** Campos do aparelho (preenchidos automaticamente quando encontrados) */
  marca?: string;
  modelo?: string;
  cor?: string;
  capacidade?: string;
  tipo?: string;

  /** Mensagem descritiva do resultado */
  message?: string;

  /** Info de duplicidade (quando o IMEI já existe no sistema) */
  duplicate?: { table: string; info: string } | null;

  /** Conjunto de campos que foram preenchidos automaticamente */
  autoFields: Set<string>;
};

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO CLIENT-SIDE (pré-filtro antes de chamar a API)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida o IMEI usando o algoritmo de Luhn (checksum).
 * Executado no client para evitar chamadas desnecessárias à API.
 */
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

/** Extrai o TAC (Type Allocation Code) — os 8 primeiros dígitos do IMEI */
export function extractTac(imei: string): string {
  return imei.replace(/\D/g, "").slice(0, 8);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Consulta centralizada de IMEI.
 *
 * Fluxo:
 *   1. Validação client-side (Luhn) — evita chamadas inválidas
 *   2. Invoca edge function `imei-lookup` que faz:
 *      - Verificação de duplicidade no banco
 *      - Consulta à API externa (fonte principal)
 *      - Fallback para cache local e base TAC
 *   3. Mapeia resposta para formato padronizado
 *
 * @param imeiRaw - IMEI bruto (pode conter espaços/traços)
 * @returns Resultado padronizado com status, dados e autoFields
 */
export async function lookupImei(imeiRaw: string): Promise<ImeiLookupResult> {
  const digits = imeiRaw.replace(/\D/g, "");

  // Validação de formato
  if (digits.length !== 15) {
    return { status: "error", message: "IMEI deve ter 15 dígitos", autoFields: new Set() };
  }

  // Validação Luhn (client-side)
  if (!isValidImei(digits)) {
    return { status: "error", message: "IMEI inválido (falha na validação)", autoFields: new Set() };
  }

  try {
    // Chama a edge function — toda a lógica de API/cache/TAC está lá
    const { data, error } = await supabase.functions.invoke("imei-lookup", {
      body: { imei: digits },
    });

    if (error) {
      console.error("[imei-service] Erro na edge function:", error);
      return {
        status: "error",
        message: "Erro de comunicação com a API. Tente novamente.",
        autoFields: new Set(),
      };
    }

    if (!data) {
      return { status: "error", message: "Resposta vazia da API", autoFields: new Set() };
    }

    // ─── Duplicidade ───
    if (data.duplicate) {
      return {
        status: "duplicate",
        message: data.message || "IMEI já cadastrado",
        duplicate: data.duplicate,
        autoFields: new Set(),
      };
    }

    // ─── Mapear campos preenchidos automaticamente ───
    const autoFields = new Set<string>();
    if (data.marca) autoFields.add("marca");
    if (data.modelo) autoFields.add("modelo");
    if (data.cor) autoFields.add("cor");
    if (data.capacidade) autoFields.add("capacidade");

    // ─── Mapear status da API → status do frontend ───
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
    console.error("[imei-service] Erro de rede:", err);
    return {
      status: "error",
      message: "Erro de conexão. Verifique sua internet e tente novamente.",
      autoFields: new Set(),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE INTELIGENTE (aprendizado)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Salva dados do aparelho no cache local para aprendizado.
 * Chamado após o usuário salvar um aparelho com sucesso.
 *
 * Quando o usuário corrige manualmente marca/modelo/cor/capacidade,
 * essa correção é armazenada e usada em futuras consultas de IMEIs
 * com o mesmo TAC (primeiros 8 dígitos).
 *
 * @param imei - IMEI completo (15 dígitos)
 * @param marca - Marca do aparelho
 * @param modelo - Modelo do aparelho
 * @param cor - Cor (opcional)
 * @param capacidade - Capacidade de armazenamento (opcional)
 */
export async function saveToImeiCache(
  imei: string,
  marca: string,
  modelo: string,
  cor?: string,
  capacidade?: string,
) {
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
    // Falha silenciosa — cache é complementar, não crítico
  }
}
