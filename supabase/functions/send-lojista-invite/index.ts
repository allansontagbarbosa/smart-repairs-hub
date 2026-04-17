// Edge function: send-lojista-invite
// Gera token de convite, atualiza lojista e dispara email de convite via fila
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

    // Tentar enfileirar email via pgmq (se existir)
    const html = renderInviteEmail({
      empresaNome,
      lojistaNome: lojista.nome,
      acceptUrl,
    });
    const subject = `${empresaNome} te convidou para o Portal Lojista`;

    let emailQueued = false;
    try {
      const { error: enqErr } = await admin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: lojista.email,
          subject,
          html,
          template_name: "lojista_invite",
        },
      });
      if (!enqErr) emailQueued = true;
    } catch (_e) {
      // sem fila configurada — segue sem enviar email automatico
    }

    return new Response(
      JSON.stringify({
        ok: true,
        accept_url: acceptUrl,
        email_queued: emailQueued,
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

function renderInviteEmail(p: { empresaNome: string; lojistaNome: string; acceptUrl: string }) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:20px;color:#1a2236">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
  <h1 style="font-size:22px;margin:0 0 16px">Você foi convidado!</h1>
  <p style="font-size:14px;line-height:1.6;color:#4b5563">
    A <strong>${escapeHtml(p.empresaNome)}</strong> convidou <strong>${escapeHtml(p.lojistaNome)}</strong>
    para acessar o Portal Lojista — o painel de parceiros da assistência técnica.
  </p>
  <p style="font-size:14px;line-height:1.6;color:#4b5563">
    Como parceiro, você poderá acompanhar o status dos aparelhos dos seus clientes,
    consultar orçamentos e o histórico completo dos serviços.
  </p>
  <p style="text-align:center;margin:28px 0">
    <a href="${p.acceptUrl}" style="background:#2563d4;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:600;font-size:14px;display:inline-block">
      Aceitar convite e acessar
    </a>
  </p>
  <p style="font-size:12px;color:#9ca3af;margin-top:24px">
    Se você não esperava esse convite, pode ignorar este email com segurança.
    Este link expira em 7 dias.
  </p>
</div></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
