// Edge function: send-lojista-invite
// Gera token de convite, atualiza lojista e dispara email de convite via send-transactional-email
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth: usar token do chamador para verificar que é staff
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const lojistaId: string | undefined = body?.lojista_id;
    if (!lojistaId) {
      return new Response(JSON.stringify({ error: "lojista_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Buscar lojista
    const { data: lojista, error: lojErr } = await admin
      .from("lojistas")
      .select("id, nome, email, empresa_id, status_acesso")
      .eq("id", lojistaId)
      .maybeSingle();
    if (lojErr || !lojista) {
      return new Response(JSON.stringify({ error: "Lojista não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!lojista.email) {
      return new Response(JSON.stringify({ error: "Lojista sem email cadastrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar nome da empresa principal (para o email)
    let empresaNome = "AssistPro";
    if (lojista.empresa_id) {
      const { data: emp } = await admin
        .from("empresas")
        .select("nome")
        .eq("id", lojista.empresa_id)
        .maybeSingle();
      if (emp?.nome) empresaNome = emp.nome;
    }

    // Gerar token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();

    const { error: updErr } = await admin
      .from("lojistas")
      .update({
        convite_token: token,
        convite_enviado_em: new Date().toISOString(),
        status_acesso: "convidado",
      })
      .eq("id", lojistaId);
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // URL de aceite — usa origin do request
    const origin = req.headers.get("origin") ?? req.headers.get("referer")?.replace(/\/$/, "") ?? "";
    const acceptUrl = `${origin}/lojista/aceitar-convite?token=${encodeURIComponent(token)}`;

    // Enviar email via send-transactional-email (template registrado)
    let emailQueued = false;
    let emailError: string | null = null;
    try {
      const { data: sendData, error: sendErr } = await admin.functions.invoke(
        "send-transactional-email",
        {
          body: {
            templateName: "lojista-invite",
            recipientEmail: lojista.email,
            idempotencyKey: `lojista-invite-${lojistaId}-${token.slice(0, 8)}`,
            templateData: {
              empresaNome,
              lojistaNome: lojista.nome,
              acceptUrl,
            },
          },
        },
      );
      if (sendErr) {
        emailError = sendErr.message ?? String(sendErr);
        console.error("[send-lojista-invite] send-transactional-email error:", sendErr);
      } else {
        emailQueued = true;
        console.log("[send-lojista-invite] email enqueued:", sendData);
      }
    } catch (e: any) {
      emailError = e?.message ?? String(e);
      console.error("[send-lojista-invite] exception calling send-transactional-email:", e);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        accept_url: acceptUrl,
        email_queued: emailQueued,
        email_error: emailError,
        email: lojista.email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
