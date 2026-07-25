// admin-proxy — Ponte segura entre o painel ditt-admin e o schema `admin`
// deste backend. Autentica via header `x-admin-panel-secret` (compartilhado
// entre painel e backend). NÃO usa JWT do Supabase — o painel não passa por
// Supabase Auth.
//
// Config no supabase/config.toml: verify_jwt = false (default do Lovable).
// Secrets necessários: ADMIN_PANEL_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_RPCS = new Set([
  "is_staff",
  "kpis_dashboard",
  "listar_empresas",
  "detalhe_empresa",
  "atividade_recente",
  "mrr_serie_12m",
  "criar_nota",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-panel-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("ADMIN_PANEL_SECRET");
  if (!expected) return json({ error: "ADMIN_PANEL_SECRET not configured" }, 500);

  const provided = req.headers.get("x-admin-panel-secret");
  if (!provided || provided !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { fn?: string; args?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const fn = body?.fn;
  const args = body?.args ?? {};
  if (!fn || typeof fn !== "string" || !ALLOWED_RPCS.has(fn)) {
    return json({ error: `RPC not allowed: ${fn}` }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { db: { schema: "admin" as never }, auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc(fn, args as never);
  if (error) {
    console.error("admin-proxy rpc error", fn, error);
    return json({ error: error.message, details: error }, 400);
  }
  return json({ data });
});
