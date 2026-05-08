import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGINS = [
  "https://admin.ditt.com",
  "https://ditt-admin-core.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Busca o plano e o stripe_price_id
    const { data: plano, error: planoError } = await supabase
      .schema("admin")
      .from("planos")
      .select("id, nome, stripe_price_id, tier")
      .eq("tier", plano_tier)
      .eq("ativo", true)
      .maybeSingle();
    
    if (planoError || !plano?.stripe_price_id) {
      return json({ success: false, error: "Plano não encontrado ou sem stripe_price_id" }, 400, headers);
    }

    // 2. Busca a empresa
    const { data: empresa, error: empresaError } = await supabase
      .from("empresas")
      .select("id, nome")
      .eq("id", empresa_id)
      .maybeSingle();
    
    if (empresaError || !empresa) {
      return json({ success: false, error: "Empresa não encontrada" }, 404, headers);
    }

    // 3. Tenta achar email do dono da empresa
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("empresa_id", empresa_id)
      .limit(1)
      .maybeSingle();
    
    let userEmail: string | undefined;
    if (profile?.user_id) {
      const { data: { user } } = await supabase.auth.admin.getUserById(profile.user_id);
      userEmail = user?.email;
    }

    // 4. Verifica se já existe assinatura com customer_id (pra reutilizar)
    const { data: assinaturaExistente } = await supabase
      .schema("admin")
      .from("assinaturas")
      .select("stripe_customer_id")
      .eq("empresa_id", empresa_id)
      .maybeSingle();

    // 5. Cria sessão de checkout
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: plano.stripe_price_id, quantity: 1 }],
      customer: assinaturaExistente?.stripe_customer_id ?? undefined,
      customer_email: !assinaturaExistente?.stripe_customer_id ? userEmail : undefined,
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
      session_id: session.id 
    }, 200, headers);

  } catch (err: any) {
    console.error("[criar-checkout-session] erro:", err);
    return json({ 
      success: false, 
      error: err.message ?? "Erro interno" 
    }, 500, headers);
  }
});

function json(body: any, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
