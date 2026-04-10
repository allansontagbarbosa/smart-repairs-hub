import { corsHeaders } from 'npm:@supabase/supabase-js/cors';
import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─── Configuration: easily swappable API provider ───
const API_CONFIG = {
  // Primary: Free IMEI/TAC check via api.imeicheck.net (no key needed for TAC)
  // Alternative providers can be swapped here
  tacLookupUrl: "https://api.imeicheck.net/v1/tac",
  // If a paid provider key is configured, use it
  apiKey: Deno.env.get("IMEI_API_KEY") || null,
  timeoutMs: 8000,
};

// ─── Known TAC database (common devices, built-in fallback) ───
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

// ─── IMEI validation (Luhn) ───
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imei } = await req.json();
    if (!imei || typeof imei !== "string") {
      return new Response(JSON.stringify({ status: "error", message: "IMEI é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const digits = imei.replace(/\D/g, "");
    if (!isValidImei(digits)) {
      return new Response(JSON.stringify({ status: "error", message: "IMEI inválido (falha na validação Luhn)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const tac = digits.slice(0, 8);

    // ─── 1. Check duplicates ───
    const { data: existingStock } = await supabase
      .from("estoque_aparelhos").select("id, marca, modelo, status").eq("imei", digits).limit(1);
    if (existingStock && existingStock.length > 0) {
      const d = existingStock[0];
      const result: LookupResult = {
        status: "error", source: "none",
        message: "IMEI já cadastrado no sistema",
        duplicate: { table: "estoque_aparelhos", info: `${d.marca} ${d.modelo} — Status: ${d.status}` },
      };
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingDevice } = await supabase
      .from("aparelhos").select("id, marca, modelo").eq("imei", digits).limit(1);
    if (existingDevice && existingDevice.length > 0) {
      const d = existingDevice[0];
      const result: LookupResult = {
        status: "error", source: "none",
        message: "IMEI já cadastrado como aparelho de cliente",
        duplicate: { table: "aparelhos", info: `${d.marca} ${d.modelo}` },
      };
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 2. Try external API (primary source) ───
    let apiResult: Partial<LookupResult> | null = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

      // Try free API: imeidb.xyz (open TAC database)
      const apiUrl = `https://imeidb.xyz/api/imei/${digits}`;
      const apiResponse = await fetch(apiUrl, {
        method: "GET",
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });
      clearTimeout(timeout);

      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        // Map API response to our format
        if (apiData && (apiData.brand || apiData.model || apiData.device_name)) {
          apiResult = {
            marca: apiData.brand || apiData.manufacturer || undefined,
            modelo: apiData.model || apiData.device_name || undefined,
            source: "api",
          };
          console.log(`[imei-lookup] API found: ${apiResult.marca} ${apiResult.modelo}`);
        }
      }
    } catch (apiErr) {
      console.log(`[imei-lookup] External API error: ${apiErr}`);
      // Continue to fallbacks
    }

    // ─── 3. If API didn't return full data, try second API ───
    if (!apiResult?.marca || !apiResult?.modelo) {
      try {
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), API_CONFIG.timeoutMs);

        // Try alternative: api-check.net TAC lookup
        const tacUrl = `https://alpha.ipqualityscore.com/api/json/phone/${tac}`;
        const tacResponse = await fetch(tacUrl, {
          method: "GET",
          signal: controller2.signal,
        });
        clearTimeout(timeout2);

        if (tacResponse.ok) {
          const tacData = await tacResponse.json();
          if (tacData && tacData.brand) {
            apiResult = {
              marca: tacData.brand || apiResult?.marca,
              modelo: tacData.model || apiResult?.modelo,
              source: "api",
            };
          }
        }
      } catch {
        console.log(`[imei-lookup] Secondary API also failed`);
      }
    }

    // ─── 4. Fallback: local cache ───
    if (!apiResult?.marca || !apiResult?.modelo) {
      const { data: cached } = await supabase
        .from("imei_device_cache").select("*").eq("tac", tac)
        .order("vezes_usado", { ascending: false }).limit(1);

      if (cached && cached.length > 0) {
        const c = cached[0];
        apiResult = {
          marca: apiResult?.marca || c.marca,
          modelo: apiResult?.modelo || c.modelo,
          cor: c.cor || undefined,
          capacidade: c.capacidade || undefined,
          source: "cache",
        };
        // Increment usage
        await supabase.from("imei_device_cache")
          .update({ vezes_usado: (c.vezes_usado || 0) + 1 }).eq("id", c.id);
        console.log(`[imei-lookup] Cache hit: ${c.marca} ${c.modelo}`);
      }
    }

    // ─── 5. Fallback: built-in TAC database ───
    if (!apiResult?.marca || !apiResult?.modelo) {
      const known = KNOWN_TACS[tac];
      if (known) {
        apiResult = {
          marca: apiResult?.marca || known.marca,
          modelo: apiResult?.modelo || known.modelo,
          capacidade: known.capacidade || apiResult?.capacidade,
          source: "tac_db",
        };
        console.log(`[imei-lookup] TAC DB hit: ${known.marca} ${known.modelo}`);
      }
    }

    // ─── 6. Build response ───
    if (apiResult?.marca && apiResult?.modelo) {
      const result: LookupResult = {
        status: apiResult.cor || apiResult.capacidade ? "found" : "partial",
        source: apiResult.source as any || "api",
        marca: apiResult.marca,
        modelo: apiResult.modelo,
        cor: apiResult.cor,
        capacidade: apiResult.capacidade,
        duplicate: null,
      };

      // Save/update cache
      try {
        await supabase.from("imei_device_cache").upsert({
          tac,
          marca: result.marca!,
          modelo: result.modelo!,
          cor: result.cor || null,
          capacidade: result.capacidade || null,
          fonte: result.source,
          vezes_usado: 1,
        }, { onConflict: "tac,marca,modelo" });
      } catch { /* silent */ }

      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Nothing found
    const result: LookupResult = {
      status: "not_found",
      source: "none",
      message: "Não foi possível identificar este aparelho. Preencha manualmente.",
      duplicate: null,
    };
    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[imei-lookup] Unhandled error:", err);
    return new Response(JSON.stringify({
      status: "error",
      source: "none",
      message: "Erro interno ao consultar IMEI",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
