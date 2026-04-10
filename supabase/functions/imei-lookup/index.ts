/**
 * ═══════════════════════════════════════════════════════════════════════════
 * IMEI Lookup Edge Function — Consulta profissional de IMEI via API
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FLUXO DE CONSULTA (cascata):
 *   1. Validação Luhn do IMEI
 *   2. Verificação de duplicidade no banco
 *   3. Consulta API externa (fonte principal)
 *   4. Fallback: cache local (imei_device_cache)
 *   5. Fallback: base TAC interna
 *
 * COMO TROCAR DE PROVEDOR DE API:
 *   - Edite a seção API_CONFIG abaixo
 *   - Ajuste a função mapApiResponse() para o novo formato de resposta
 *   - Adicione o secret IMEI_API_KEY se necessário
 *
 * SECRETS NECESSÁRIOS (configurar via Lovable Cloud):
 *   - IMEI_API_KEY (opcional) — chave de autenticação da API externa
 *   - SUPABASE_URL (automático)
 *   - SUPABASE_SERVICE_ROLE_KEY (automático)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { corsHeaders } from 'npm:@supabase/supabase-js/cors';
import { createClient } from 'npm:@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 CONFIGURAÇÃO DA API — EDITE AQUI PARA TROCAR DE PROVEDOR
// ─────────────────────────────────────────────────────────────────────────────
const API_CONFIG = {
  /**
   * URL base do provedor de consulta IMEI.
   * O TAC (8 primeiros dígitos do IMEI) será adicionado ao final.
   *
   * Provedores suportados (descomente o desejado):
   *   - imeidb.xyz (gratuito, sem chave)
   *   - imei.info (pago, requer IMEI_API_KEY)
   *   - imeicheck.net (pago, requer IMEI_API_KEY)
   *
   * Para adicionar um novo provedor:
   *   1. Altere baseUrl e buildRequestUrl()
   *   2. Ajuste buildRequestHeaders()
   *   3. Ajuste mapApiResponse() para o formato de retorno
   */
  baseUrl: "https://api.imeidb.xyz/v1/devices",

  /** Chave da API (lida do secret IMEI_API_KEY, null se não configurada) */
  apiKey: Deno.env.get("IMEI_API_KEY") || null,

  /** Timeout da requisição em milissegundos */
  timeoutMs: 8000,

  /** Método HTTP da API */
  method: "GET" as const,
};

/**
 * Monta a URL completa da requisição.
 * Ajuste conforme o padrão do provedor escolhido.
 *
 * Exemplos por provedor:
 *   imeidb.xyz:    `${baseUrl}/${tac}`
 *   imei.info:     `https://api.imei.info/check?imei=${fullImei}&apikey=${key}`
 *   imeicheck.net: `https://api.imeicheck.net/v1/tac/${tac}`
 */
function buildRequestUrl(imei: string, tac: string): string {
  // ── Provedor atual: imeidb.xyz (consulta por TAC, gratuito) ──
  return `${API_CONFIG.baseUrl}/${tac}`;
}

/**
 * Monta os headers da requisição.
 * Adicione aqui Authorization, X-API-Key, etc. conforme o provedor.
 *
 * Exemplos:
 *   Bearer token:  { "Authorization": `Bearer ${API_CONFIG.apiKey}` }
 *   API Key header: { "X-API-Key": API_CONFIG.apiKey }
 */
function buildRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "User-Agent": "SmartRepairsHub/1.0",
  };

  // Descomentar quando usar provedor pago com API key:
  // if (API_CONFIG.apiKey) {
  //   headers["Authorization"] = `Bearer ${API_CONFIG.apiKey}`;
  // }

  return headers;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MAPEAMENTO DA RESPOSTA DA API → CAMPOS INTERNOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cada provedor retorna dados em formato diferente. Ajuste esta função
 * para mapear os campos da API para os campos do sistema.
 *
 * Campos internos esperados:
 *   - marca       → nome da fabricante (Apple, Samsung, Motorola)
 *   - modelo      → nome do modelo (iPhone 15 Pro Max, Galaxy S24)
 *   - cor         → cor do aparelho (Preto, Azul, Titanium)
 *   - capacidade  → armazenamento (128GB, 256GB, 512GB)
 *   - tipo        → tipo de dispositivo (smartphone, tablet)
 *
 * Exemplos de mapeamento por provedor:
 *
 *   imeidb.xyz:
 *     apiData.brand → marca
 *     apiData.name  → modelo
 *
 *   imei.info:
 *     apiData.device_image → ignorar
 *     apiData.brand_name   → marca
 *     apiData.model_name   → modelo
 *     apiData.device_name  → modelo (fallback)
 *
 *   imeicheck.net:
 *     apiData.manufacturer → marca
 *     apiData.model        → modelo
 *     apiData.storage      → capacidade
 */
type MappedDevice = {
  marca?: string;
  modelo?: string;
  cor?: string;
  capacidade?: string;
  tipo?: string;
};

function mapApiResponse(apiData: any): MappedDevice | null {
  if (!apiData) return null;

  // ── Mapeamento para imeidb.xyz ──
  // Formato: { brand: "Apple", name: "iPhone 15 Pro", type: "Smartphone", ... }
  const marca = apiData.brand || apiData.manufacturer || apiData.brand_name;
  const modelo = apiData.name || apiData.model || apiData.model_name || apiData.device_name;

  if (!marca && !modelo) return null;

  return {
    marca: marca || undefined,
    modelo: modelo || undefined,
    cor: apiData.color || apiData.colour || undefined,
    capacidade: apiData.storage || apiData.capacity || apiData.internal_memory || undefined,
    tipo: apiData.type || apiData.device_type || undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE TAC INTERNA — Fallback local para dispositivos comuns no Brasil
// ─────────────────────────────────────────────────────────────────────────────
const KNOWN_TACS: Record<string, { marca: string; modelo: string; capacidade?: string }> = {
  // Apple iPhones
  "35397110": { marca: "Apple", modelo: "iPhone 15 Pro Max" },
  "35397010": { marca: "Apple", modelo: "iPhone 15 Pro" },
  "35395510": { marca: "Apple", modelo: "iPhone 15 Plus" },
  "35395010": { marca: "Apple", modelo: "iPhone 15" },
  "35332211": { marca: "Apple", modelo: "iPhone 14 Pro Max" },
  "35332210": { marca: "Apple", modelo: "iPhone 14 Pro Max" },
  "35328211": { marca: "Apple", modelo: "iPhone 14 Pro" },
  "35325811": { marca: "Apple", modelo: "iPhone 14 Plus" },
  "35325010": { marca: "Apple", modelo: "iPhone 14" },
  "35904211": { marca: "Apple", modelo: "iPhone 13 Pro Max" },
  "35904210": { marca: "Apple", modelo: "iPhone 13 Pro" },
  "35395311": { marca: "Apple", modelo: "iPhone 13" },
  "35324710": { marca: "Apple", modelo: "iPhone 13 mini" },
  "35407115": { marca: "Apple", modelo: "iPhone 12 Pro Max" },
  "35407110": { marca: "Apple", modelo: "iPhone 12 Pro" },
  "35340511": { marca: "Apple", modelo: "iPhone 12" },
  "35340510": { marca: "Apple", modelo: "iPhone 12 mini" },
  "35391510": { marca: "Apple", modelo: "iPhone SE (3rd gen)" },
  "35316110": { marca: "Apple", modelo: "iPhone 11 Pro Max" },
  "35316010": { marca: "Apple", modelo: "iPhone 11 Pro" },
  "35316210": { marca: "Apple", modelo: "iPhone 11" },
  "35490111": { marca: "Apple", modelo: "iPhone 16 Pro Max" },
  "35490110": { marca: "Apple", modelo: "iPhone 16 Pro" },
  "35489911": { marca: "Apple", modelo: "iPhone 16 Plus" },
  "35489910": { marca: "Apple", modelo: "iPhone 16" },
  // Samsung Galaxy S series
  "35260212": { marca: "Samsung", modelo: "Galaxy S24 Ultra" },
  "35260211": { marca: "Samsung", modelo: "Galaxy S24+" },
  "35260210": { marca: "Samsung", modelo: "Galaxy S24" },
  "35822512": { marca: "Samsung", modelo: "Galaxy S23 Ultra" },
  "35822511": { marca: "Samsung", modelo: "Galaxy S23+" },
  "35822510": { marca: "Samsung", modelo: "Galaxy S23" },
  "35555512": { marca: "Samsung", modelo: "Galaxy S22 Ultra" },
  "35555511": { marca: "Samsung", modelo: "Galaxy S22+" },
  "35555510": { marca: "Samsung", modelo: "Galaxy S22" },
  // Samsung Galaxy A series
  "35290512": { marca: "Samsung", modelo: "Galaxy A54" },
  "35290511": { marca: "Samsung", modelo: "Galaxy A34" },
  "35290510": { marca: "Samsung", modelo: "Galaxy A14" },
  // Motorola
  "35473810": { marca: "Motorola", modelo: "Moto G84" },
  "35473710": { marca: "Motorola", modelo: "Moto G54" },
  "35473610": { marca: "Motorola", modelo: "Moto G34" },
  "35766710": { marca: "Motorola", modelo: "Moto Edge 40" },
  // Xiaomi
  "86769804": { marca: "Xiaomi", modelo: "Redmi Note 13 Pro" },
  "86769704": { marca: "Xiaomi", modelo: "Redmi Note 13" },
  "86769604": { marca: "Xiaomi", modelo: "Redmi 13C" },
  "86826904": { marca: "Xiaomi", modelo: "Poco X6 Pro" },
};

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO IMEI (Luhn)
// ─────────────────────────────────────────────────────────────────────────────
function isValidImei(imei: string): boolean {
  if (imei.length !== 15 || !/^\d{15}$/.test(imei)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = parseInt(imei[i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE RESPOSTA
// ─────────────────────────────────────────────────────────────────────────────
type LookupResult = {
  status: "found" | "partial" | "not_found" | "error";
  source: "api" | "cache" | "tac_db" | "none";
  marca?: string;
  modelo?: string;
  cor?: string;
  capacidade?: string;
  tipo?: string;
  message?: string;
  duplicate?: { table: string; info: string } | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (body: LookupResult, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { imei } = await req.json();
    if (!imei || typeof imei !== "string") {
      return respond({ status: "error", source: "none", message: "IMEI é obrigatório" }, 400);
    }

    const digits = imei.replace(/\D/g, "");
    if (!isValidImei(digits)) {
      return respond({ status: "error", source: "none", message: "IMEI inválido (falha na validação Luhn)" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const tac = digits.slice(0, 8);

    // ═══ ETAPA 1: Verificar duplicidade ═══
    const { data: existingStock } = await supabase
      .from("estoque_aparelhos").select("id, marca, modelo, status").eq("imei", digits).limit(1);
    if (existingStock?.length) {
      const d = existingStock[0];
      return respond({
        status: "error", source: "none",
        message: "IMEI já cadastrado no estoque",
        duplicate: { table: "estoque_aparelhos", info: `${d.marca} ${d.modelo} — Status: ${d.status}` },
      });
    }

    const { data: existingDevice } = await supabase
      .from("aparelhos").select("id, marca, modelo").eq("imei", digits).limit(1);
    if (existingDevice?.length) {
      const d = existingDevice[0];
      return respond({
        status: "error", source: "none",
        message: "IMEI já cadastrado como aparelho de cliente",
        duplicate: { table: "aparelhos", info: `${d.marca} ${d.modelo}` },
      });
    }

    // ═══ ETAPA 2: Consulta API externa (FONTE PRINCIPAL) ═══
    let device: MappedDevice | null = null;
    let source: LookupResult["source"] = "none";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);
      const url = buildRequestUrl(digits, tac);

      console.log(`[imei-lookup] Consultando API: ${url}`);

      const apiResponse = await fetch(url, {
        method: API_CONFIG.method,
        signal: controller.signal,
        headers: buildRequestHeaders(),
      });
      clearTimeout(timeout);

      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        device = mapApiResponse(apiData);
        if (device) {
          source = "api";
          console.log(`[imei-lookup] API retornou: ${device.marca} ${device.modelo}`);
        }
      } else {
        console.log(`[imei-lookup] API retornou status ${apiResponse.status}`);
      }
    } catch (apiErr) {
      // Timeout ou erro de rede — seguir para fallbacks
      console.log(`[imei-lookup] Erro na API externa: ${apiErr}`);
    }

    // ═══ ETAPA 3: Fallback — cache local ═══
    if (!device?.marca || !device?.modelo) {
      const { data: cached } = await supabase
        .from("imei_device_cache").select("*").eq("tac", tac)
        .order("vezes_usado", { ascending: false }).limit(1);

      if (cached?.length) {
        const c = cached[0];
        device = {
          marca: device?.marca || c.marca,
          modelo: device?.modelo || c.modelo,
          cor: device?.cor || c.cor || undefined,
          capacidade: device?.capacidade || c.capacidade || undefined,
        };
        source = source === "api" ? "api" : "cache";
        // Incrementar uso
        await supabase.from("imei_device_cache")
          .update({ vezes_usado: (c.vezes_usado || 0) + 1, updated_at: new Date().toISOString() })
          .eq("id", c.id);
        console.log(`[imei-lookup] Cache hit: ${c.marca} ${c.modelo}`);
      }
    }

    // ═══ ETAPA 4: Fallback — base TAC interna ═══
    if (!device?.marca || !device?.modelo) {
      const known = KNOWN_TACS[tac];
      if (known) {
        device = {
          marca: device?.marca || known.marca,
          modelo: device?.modelo || known.modelo,
          capacidade: device?.capacidade || known.capacidade,
        };
        source = source !== "none" ? source : "tac_db";
        console.log(`[imei-lookup] TAC DB hit: ${known.marca} ${known.modelo}`);
      }
    }

    // ═══ ETAPA 5: Montar resposta ═══
    if (device?.marca && device?.modelo) {
      const hasFullData = !!(device.cor || device.capacidade);
      const result: LookupResult = {
        status: hasFullData ? "found" : "partial",
        source,
        marca: device.marca,
        modelo: device.modelo,
        cor: device.cor,
        capacidade: device.capacidade,
        tipo: device.tipo,
        duplicate: null,
      };

      // Salvar/atualizar cache para futuras consultas
      try {
        await supabase.from("imei_device_cache").upsert({
          tac,
          marca: result.marca!,
          modelo: result.modelo!,
          cor: result.cor || null,
          capacidade: result.capacidade || null,
          fonte: source,
          vezes_usado: 1,
        }, { onConflict: "tac,marca,modelo" });
      } catch { /* cache silencioso */ }

      return respond(result);
    }

    // Nada encontrado
    return respond({
      status: "not_found",
      source: "none",
      message: "Não foi possível identificar este aparelho. Preencha manualmente.",
      duplicate: null,
    });

  } catch (err) {
    console.error("[imei-lookup] Erro não tratado:", err);
    return new Response(JSON.stringify({
      status: "error",
      source: "none",
      message: "Erro interno ao consultar IMEI",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
