import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const ALLOWED_ORIGINS = [
  "https://admin.ditt.com",
  "https://ditt-admin-core.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// Helper pra fetch direto no PostgREST com schema admin
async function fetchAdmin(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Accept-Profile": "admin",
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PostgREST admin error ${res.status}: ${txt}`);
  }
  return res.json();
}

// Helper pra fetch direto no PostgREST schema public
async function fetchPublic(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PostgREST public error ${res.status}: ${txt}`);
  }
  return res.json();
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    const { empresa_id, plano_tier, success_url, cancel_url } = await req.json();
    if (!empresa_id || !plano_tier) {
      return json({ success: false, error: "empresa_id e plano_tier são obrigatórios" }, 400, headers);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-11-20.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 1. Busca plano em admin.planos
    const planos = await fetchAdmin(`/planos?tier=eq.${encodeURIComponent(plano_tier)}&ativo=eq.true&select=id,nome,stripe_price_id,tier`);
    if (!Array.isArray(planos) || planos.length === 0 || !planos[0].stripe_price_id) {
      return json({ success: false, error: "Plano não encontrado ou sem stripe_price_id" }, 400, headers);
    }
    const plano = planos[0];

    // 2. Busca empresa em public.empresas
    const empresas = await fetchPublic(`/empresas?id=eq.${empresa_id}&select=id,nome`);
    if (!Array.isArray(empresas) || empresas.length === 0) {
      return json({ success: false, error: "Empresa não encontrada" }, 404, headers);
    }
    const empresa = empresas[0];

    // 3. Busca email do dono da empresa via user_profiles + auth.users
    const profiles = await fetchPublic(`/user_profiles?empresa_id=eq.${empresa_id}&select=user_id&limit=1`);
    let userEmail: string | undefined;
    if (Array.isArray(profiles) && profiles.length > 0 && profiles[0].user_id) {
      // auth.users via Admin API
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${profiles[0].user_id}`, {
        headers: {
          "apikey": SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        }
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        userEmail = userData.email;
      }
    }

    // 4. Verifica se já existe assinatura com customer_id
    const assinaturas = await fetchAdmin(`/assinaturas?empresa_id=eq.${empresa_id}&select=stripe_customer_id&limit=1`);
    const customerExistente = (Array.isArray(assinaturas) && assinaturas[0]?.stripe_customer_id) || undefined;

    // 5. Cria sessão de checkout
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: plano.stripe_price_id, quantity: 1 }],
      customer: customerExistente,
      customer_email: !customerExistente ? userEmail : undefined,
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          empresa_id,
          plano_tier,
          plano_id: plano.id,
          empresa_nome: empresa.nome,
        },
      },
      metadata: {
        empresa_id,
        plano_tier,
        empresa_nome: empresa.nome,
      },
      success_url: success_url ?? "https://ditt-admin-core.lovable.app/billing?success=1",
      cancel_url: cancel_url ?? "https://ditt-admin-core.lovable.app/billing?canceled=1",
      locale: "pt-BR",
      allow_promotion_codes: true,
      billing_address_collection: "required",
    });

    return json({
      success: true,
      url: session.url,
      session_id: session.id,
    }, 200, headers);

  } catch (err: any) {
    console.error("[criar-checkout-session] erro:", err);
    return json({
      success: false,
      error: err.message ?? "Erro interno",
    }, 500, headers);
  }
});

function json(body: any, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
