/**
 * ═══════════════════════════════════════════════════════════════════════════
 * IMEI Lookup Edge Function — Consulta profissional via IMEI.info API
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FLUXO DE CONSULTA (cascata):
 *   1. Validação Luhn do IMEI
 *   2. Verificação de duplicidade no banco
 *   3. Consulta API IMEI.info (assíncrona: submit → polling)
 *   4. Fallback: cache local (imei_device_cache)
 *   5. Fallback: base TAC interna
 *
 * COMO FUNCIONA O IMEI.info:
 *   - Submit: GET /check/{serviceId}/?API_KEY=...&imei=... → retorna history_id
 *   - Polling: GET /search_history/{history_id}/?API_KEY=... → aguarda status "Done"
 *   - Docs: https://www.imei.info/api/imei/docs/
 *
 * SECRETS NECESSÁRIOS (configurar via Lovable Cloud):
 *   - IMEI_API_KEY — token da conta IMEI.info
 *   - SUPABASE_URL (automático)
 *   - SUPABASE_SERVICE_ROLE_KEY (automático)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { corsHeaders } from 'npm:@supabase/supabase-js/cors';
import { createClient } from 'npm:@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 CONFIGURAÇÃO DA API IMEI.info
// ─────────────────────────────────────────────────────────────────────────────
const API_CONFIG = {
  baseUrl: "https://www.imei.info/api",

  /**
   * Service ID do IMEI.info. Depende do seu plano/pacote.
   * Exemplos:
   *   12 = APPLE: Warranty Check (~$0.04/req)
   *   2  = APPLE: Carrier & Lock Status & FMI (~$0.36/req)
   * Consulte seu dashboard para ver os services disponíveis.
   */
  serviceId: 12,

  /** Chave da API (lida do secret IMEI_API_KEY) */
  apiKey: Deno.env.get("IMEI_API_KEY") || null,

  /** Intervalo de polling em ms */
  pollIntervalMs: 2500,

  /** Máximo de tentativas de polling */
  maxPollAttempts: 8,
};

const API_HEADERS: Record<string, string> = {
  "Accept": "application/json",
  "User-Agent": "SmartRepairsHub/1.0",
};

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
type MappedDevice = {
  marca?: string;
  modelo?: string;
  cor?: string;
  capacidade?: string;
  tipo?: string;
};

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
// CONSULTA ASSÍNCRONA AO IMEI.info (submit + polling)
// ─────────────────────────────────────────────────────────────────────────────
async function queryImeiInfoApi(imei: string): Promise<MappedDevice | null> {
  if (!API_CONFIG.apiKey) {
    console.log("[imei-lookup] IMEI_API_KEY não configurada, pulando API");
    return null;
  }

  // ── STEP 1: Submeter checagem ──
  const checkUrl = `${API_CONFIG.baseUrl}/check/${API_CONFIG.serviceId}/?API_KEY=${API_CONFIG.apiKey}&imei=${imei}`;
  console.log(`[imei-lookup] Submetendo check: service=${API_CONFIG.serviceId}`);

  const submitResp = await fetch(checkUrl, { headers: API_HEADERS });
  const submitData = await submitResp.json();

  if (!submitResp.ok || submitData.error) {
    console.log(`[imei-lookup] Erro no submit: ${JSON.stringify(submitData)}`);
    return null;
  }

  if (submitData.status === "Rejected") {
    console.log(`[imei-lookup] Rejeitado: ${submitData.result}`);
    return null;
  }

  const historyId = submitData.history_id || submitData.id;
  if (!historyId) {
    console.log(`[imei-lookup] Sem history_id: ${JSON.stringify(submitData)}`);
    return null;
  }

  console.log(`[imei-lookup] Aguardando resultado, history_id=${historyId}`);

  // ── STEP 2: Polling do resultado ──
  const historyUrl = `${API_CONFIG.baseUrl}/search_history/${historyId}/?API_KEY=${API_CONFIG.apiKey}`;

  for (let attempt = 0; attempt < API_CONFIG.maxPollAttempts; attempt++) {
    await new Promise(r => setTimeout(r, API_CONFIG.pollIntervalMs));

    const pollResp = await fetch(historyUrl, { headers: API_HEADERS });
    if (!pollResp.ok) continue;

    const pollData = await pollResp.json();
    console.log(`[imei-lookup] Poll #${attempt + 1}: status=${pollData.status}`);

    if (pollData.status === "Done" && pollData.result) {
      return mapImeiInfoResult(pollData);
    }
    if (pollData.status === "Rejected" || pollData.status === "Error") {
      console.log(`[imei-lookup] Falha: ${pollData.result}`);
      return null;
    }
  }

  console.log(`[imei-lookup] Timeout após ${API_CONFIG.maxPollAttempts} tentativas`);
  return null;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MAPEAMENTO DA RESPOSTA DO IMEI.info
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Resposta do service 12 (Apple Warranty Check):
 * {
 *   "service": "APPLE: Warranty Check",
 *   "result": {
 *     "model": "iPhone 17 PRO MAX (A3257)",
 *     "activation_status": "Activated",
 *     "warranty_status": "AppleCare One",
 *     ...
 *   }
 * }
 */
function mapImeiInfoResult(pollData: any): MappedDevice | null {
  const result = pollData.result;
  if (!result || typeof result === "string") return null;

  const service = (pollData.service || "").toLowerCase();

  // Inferir marca pelo nome do service
  let marca: string | undefined;
  if (service.includes("apple")) marca = "Apple";
  else if (service.includes("samsung")) marca = "Samsung";
  else if (service.includes("xiaomi")) marca = "Xiaomi";
  else if (service.includes("motorola")) marca = "Motorola";
  else if (service.includes("huawei")) marca = "Huawei";

  // Extrair modelo
  let modelo = result.model || result.model_name || result.device_name;
  if (modelo) {
    // Remover código interno: "iPhone 17 PRO MAX (A3257)" → "iPhone 17 Pro Max"
    modelo = modelo.replace(/\s*\([A-Z0-9]+\)\s*$/, "").trim();
    // Inferir marca do nome do modelo
    if (!marca) {
      const m = modelo.toLowerCase();
      if (m.startsWith("iphone") || m.startsWith("ipad")) marca = "Apple";
      else if (m.startsWith("galaxy") || m.startsWith("sm-")) marca = "Samsung";
      else if (m.startsWith("moto")) marca = "Motorola";
      else if (m.startsWith("redmi") || m.startsWith("poco") || m.startsWith("mi ")) marca = "Xiaomi";
    }
  }

  if (!marca && !modelo) return null;

  console.log(`[imei-lookup] API resultado: ${marca} ${modelo}`);

  return {
    marca,
    modelo,
    cor: result.color || result.colour || undefined,
    capacidade: result.storage || result.capacity || undefined,
    tipo: undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BASE TAC INTERNA — Fallback local para dispositivos comuns no Brasil
// ─────────────────────────────────────────────────────────────────────────────
const KNOWN_TACS: Record<string, { marca: string; modelo: string; capacidade?: string }> = {
  // ═══ Apple iPhones ═══
  "35490111": { marca: "Apple", modelo: "iPhone 16 Pro Max" },
  "35490110": { marca: "Apple", modelo: "iPhone 16 Pro" },
  "35489911": { marca: "Apple", modelo: "iPhone 16 Plus" },
  "35489910": { marca: "Apple", modelo: "iPhone 16" },
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
  "35316110": { marca: "Apple", modelo: "iPhone 11 Pro Max" },
  "35316010": { marca: "Apple", modelo: "iPhone 11 Pro" },
  "35316210": { marca: "Apple", modelo: "iPhone 11" },
  "35391510": { marca: "Apple", modelo: "iPhone SE (3rd gen)" },
  "35391410": { marca: "Apple", modelo: "iPhone SE (2nd gen)" },
  "35694209": { marca: "Apple", modelo: "iPhone XS Max" },
  "35694109": { marca: "Apple", modelo: "iPhone XS" },
  "35693509": { marca: "Apple", modelo: "iPhone XR" },
  "35299509": { marca: "Apple", modelo: "iPhone X" },
  "35320008": { marca: "Apple", modelo: "iPhone 8 Plus" },
  "35320108": { marca: "Apple", modelo: "iPhone 8" },
  "35319607": { marca: "Apple", modelo: "iPhone 7 Plus" },
  "35319507": { marca: "Apple", modelo: "iPhone 7" },
  "35104697": { marca: "Apple", modelo: "iPhone 7" },
  "35389006": { marca: "Apple", modelo: "iPhone 6s Plus" },
  "35388906": { marca: "Apple", modelo: "iPhone 6s" },
  "35332706": { marca: "Apple", modelo: "iPhone 6 Plus" },
  "35332606": { marca: "Apple", modelo: "iPhone 6" },
  // ═══ Samsung Galaxy S ═══
  "35260212": { marca: "Samsung", modelo: "Galaxy S24 Ultra" },
  "35260211": { marca: "Samsung", modelo: "Galaxy S24+" },
  "35260210": { marca: "Samsung", modelo: "Galaxy S24" },
  "35822512": { marca: "Samsung", modelo: "Galaxy S23 Ultra" },
  "35822511": { marca: "Samsung", modelo: "Galaxy S23+" },
  "35822510": { marca: "Samsung", modelo: "Galaxy S23" },
  "35555512": { marca: "Samsung", modelo: "Galaxy S22 Ultra" },
  "35555511": { marca: "Samsung", modelo: "Galaxy S22+" },
  "35555510": { marca: "Samsung", modelo: "Galaxy S22" },
  "35230011": { marca: "Samsung", modelo: "Galaxy S21 Ultra" },
  "35230010": { marca: "Samsung", modelo: "Galaxy S21" },
  // ═══ Samsung Galaxy A ═══
  "35290512": { marca: "Samsung", modelo: "Galaxy A54" },
  "35290511": { marca: "Samsung", modelo: "Galaxy A34" },
  "35290510": { marca: "Samsung", modelo: "Galaxy A14" },
  "35617311": { marca: "Samsung", modelo: "Galaxy A55" },
  "35617211": { marca: "Samsung", modelo: "Galaxy A35" },
  "35617111": { marca: "Samsung", modelo: "Galaxy A15" },
  "35617011": { marca: "Samsung", modelo: "Galaxy A05" },
  "35281610": { marca: "Samsung", modelo: "Galaxy A53" },
  "35281510": { marca: "Samsung", modelo: "Galaxy A33" },
  "35281410": { marca: "Samsung", modelo: "Galaxy A23" },
  "35281310": { marca: "Samsung", modelo: "Galaxy A13" },
  "35281210": { marca: "Samsung", modelo: "Galaxy A03" },
  "35470510": { marca: "Samsung", modelo: "Galaxy A52" },
  "35470410": { marca: "Samsung", modelo: "Galaxy A32" },
  "35470310": { marca: "Samsung", modelo: "Galaxy A22" },
  "35470210": { marca: "Samsung", modelo: "Galaxy A12" },
  "35470110": { marca: "Samsung", modelo: "Galaxy A02" },
  // ═══ Samsung M / Z ═══
  "35659911": { marca: "Samsung", modelo: "Galaxy M54" },
  "35659811": { marca: "Samsung", modelo: "Galaxy M34" },
  "35659711": { marca: "Samsung", modelo: "Galaxy M14" },
  "35711612": { marca: "Samsung", modelo: "Galaxy Z Fold5" },
  "35711512": { marca: "Samsung", modelo: "Galaxy Z Flip5" },
  // ═══ Motorola ═══
  "35473810": { marca: "Motorola", modelo: "Moto G84" },
  "35473710": { marca: "Motorola", modelo: "Moto G54" },
  "35473610": { marca: "Motorola", modelo: "Moto G34" },
  "35766710": { marca: "Motorola", modelo: "Moto Edge 40" },
  "35766810": { marca: "Motorola", modelo: "Moto Edge 40 Pro" },
  "35473510": { marca: "Motorola", modelo: "Moto G73" },
  "35473410": { marca: "Motorola", modelo: "Moto G53" },
  "35473310": { marca: "Motorola", modelo: "Moto G23" },
  "35473210": { marca: "Motorola", modelo: "Moto G13" },
  "35766610": { marca: "Motorola", modelo: "Moto Edge 30" },
  "35684710": { marca: "Motorola", modelo: "Moto G82" },
  "35684610": { marca: "Motorola", modelo: "Moto G72" },
  "35684510": { marca: "Motorola", modelo: "Moto G62" },
  "35684410": { marca: "Motorola", modelo: "Moto G42" },
  "35684310": { marca: "Motorola", modelo: "Moto G32" },
  "35684210": { marca: "Motorola", modelo: "Moto G22" },
  "35684110": { marca: "Motorola", modelo: "Moto E22" },
  "35766510": { marca: "Motorola", modelo: "Moto Razr 40" },
  // ═══ Xiaomi ═══
  "86769804": { marca: "Xiaomi", modelo: "Redmi Note 13 Pro" },
  "86769704": { marca: "Xiaomi", modelo: "Redmi Note 13" },
  "86769604": { marca: "Xiaomi", modelo: "Redmi 13C" },
  "86826904": { marca: "Xiaomi", modelo: "Poco X6 Pro" },
  "86826804": { marca: "Xiaomi", modelo: "Poco X6" },
  "86826704": { marca: "Xiaomi", modelo: "Poco M6 Pro" },
  "86058604": { marca: "Xiaomi", modelo: "Redmi Note 12 Pro" },
  "86058504": { marca: "Xiaomi", modelo: "Redmi Note 12" },
  "86058404": { marca: "Xiaomi", modelo: "Redmi 12" },
  "86058304": { marca: "Xiaomi", modelo: "Poco X5 Pro" },
  "86058204": { marca: "Xiaomi", modelo: "Poco X5" },
  "86393604": { marca: "Xiaomi", modelo: "Xiaomi 14" },
  "86393504": { marca: "Xiaomi", modelo: "Xiaomi 13" },
  "86393404": { marca: "Xiaomi", modelo: "Xiaomi 13 Lite" },
  // ═══ Outros ═══
  "86812804": { marca: "Realme", modelo: "Realme 12 Pro+" },
  "86812704": { marca: "Realme", modelo: "Realme 12" },
  "86812604": { marca: "Realme", modelo: "Realme C55" },
  "86480104": { marca: "OPPO", modelo: "Reno 11" },
  "86480004": { marca: "OPPO", modelo: "OPPO A78" },
  // ═══ Tablets ═══
  "35830311": { marca: "Apple", modelo: "iPad Pro 12.9 (6th gen)" },
  "35830211": { marca: "Apple", modelo: "iPad Pro 11 (4th gen)" },
  "35830111": { marca: "Apple", modelo: "iPad Air (5th gen)" },
  "35830011": { marca: "Apple", modelo: "iPad (10th gen)" },
  "35273011": { marca: "Samsung", modelo: "Galaxy Tab S9" },
  "35273111": { marca: "Samsung", modelo: "Galaxy Tab A9" },
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

    // ═══ ETAPA 2: Consulta API IMEI.info (assíncrona) ═══
    let device: MappedDevice | null = null;
    let source: LookupResult["source"] = "none";

    try {
      device = await queryImeiInfoApi(digits);
      if (device) {
        source = "api";
      }
    } catch (apiErr) {
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

      // Salvar/atualizar cache
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
