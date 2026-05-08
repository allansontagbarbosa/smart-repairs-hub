import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

// Helper: PostgREST direto no schema admin
async function fetchAdmin(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Accept-Profile": "admin",
      "Content-Profile": "admin",
      "Content-Type": "application/json",
      "Prefer": opts.method === "PATCH" || opts.method === "POST" ? "return=representation" : "",
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PostgREST admin error ${res.status}: ${txt}`);
  }
  return res.status === 204 ? null : res.json();
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error("[stripe-webhook] Missing stripe-signature header");
    return new Response("No signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err: any) {
    console.error("[stripe-webhook] HMAC validation failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log(`[stripe-webhook] Evento recebido: ${event.type} (${event.id})`);

  try {
    const jaProcessado = await fetchAdmin(
      `/eventos_billing?stripe_event_id=eq.${event.id}&select=id&limit=1`
    );
    if (Array.isArray(jaProcessado) && jaProcessado.length > 0) {
      console.log(`[stripe-webhook] Evento ${event.id} já processado, ignorando`);
      return new Response(JSON.stringify({ received: true, duplicated: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err: any) {
    console.error("[stripe-webhook] Erro checando idempotência:", err.message);
  }

  try {
    await registrarEvento(event);
    console.log(`[stripe-webhook] Evento ${event.id} registrado com sucesso`);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error(`[stripe-webhook] Erro processando ${event.type}:`, err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

async function registrarEvento(event: Stripe.Event) {
  await fetchAdmin("/eventos_billing", {
    method: "POST",
    body: JSON.stringify({
      stripe_event_id: event.id,
      tipo: event.type,
      payload: event.data.object,
      processado_em: new Date().toISOString(),
    }),
  });
}
