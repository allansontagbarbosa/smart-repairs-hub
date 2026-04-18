// Edge function: accept-lojista-invite
// Valida token de convite e gera magic link de 1 clique para o lojista.
// Retorna SEMPRE status 200 com payload estruturado { ok, code, message } para
// que o frontend possa exibir mensagens amigáveis (o Supabase SDK descarta o
// body em respostas não-2xx, então usamos códigos no corpo).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json().catch(() => ({}));
    const tokenRaw: string | undefined = body?.token;
    const token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";
    const action: string = body?.action ?? "validate"; // validate | accept

    if (!token) {
      return json({ ok: false, code: "token_missing", message: "Token ausente." });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: lojista, error: lErr } = await admin
      .from("lojistas")
      .select("id, nome, email, status_acesso, convite_token, convite_enviado_em, convite_aceito_em, empresa_id")
      .eq("convite_token", token)
      .maybeSingle();

    if (lErr) {
      console.error("[accept-lojista-invite] db error:", lErr);
      return json({ ok: false, code: "db_error", message: "Erro ao consultar convite." });
    }

    if (!lojista) {
      // Pode ter sido aceito (token zerado) ou um link antigo após reenvio
      return json({
        ok: false,
        code: "token_not_found",
        message:
          "Este convite não é mais válido. Pode ter sido aceito ou substituído por um novo. " +
          "Solicite à assistência um novo link.",
      });
    }

    // Validar expiração: 7 dias
    if (lojista.convite_enviado_em) {
      const enviado = new Date(lojista.convite_enviado_em).getTime();
      const agora = Date.now();
      const diasMs = 7 * 24 * 60 * 60 * 1000;
      if (agora - enviado > diasMs) {
        return json({
          ok: false,
          code: "token_expired",
          message: "Este convite expirou. Peça à assistência para enviar um novo.",
        });
      }
    }

    if (!lojista.email) {
      return json({
        ok: false,
        code: "no_email",
        message: "Lojista sem email cadastrado. Contate a assistência.",
      });
    }

    // Nome da empresa
    let empresaNome = "AssistPro";
    if (lojista.empresa_id) {
      const { data: emp } = await admin
        .from("empresas")
        .select("nome")
        .eq("id", lojista.empresa_id)
        .maybeSingle();
      if (emp?.nome) empresaNome = emp.nome;
    }

    if (action === "validate") {
      return json({
        ok: true,
        lojista: { id: lojista.id, nome: lojista.nome, email: lojista.email },
        empresa_nome: empresaNome,
      });
    }

    // ACTION=accept — gerar magic link e marcar como ativo
    const origin = req.headers.get("origin") ?? "";
    const redirectTo = `${origin}/lojista`;

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: lojista.email,
      options: { redirectTo },
    });

    if (linkErr || !linkData) {
      console.error("[accept-lojista-invite] generateLink error:", linkErr);
      return json({
        ok: false,
        code: "magiclink_failed",
        message: "Não foi possível gerar o link de acesso. Tente novamente em instantes.",
      });
    }

    const userId = linkData.user?.id;
    const actionLink = (linkData as any).properties?.action_link as string | undefined;

    // Atualizar lojista: ativo, vincular user_id, limpar token
    if (userId) {
      await admin
        .from("lojistas")
        .update({
          status_acesso: "ativo",
          convite_aceito_em: new Date().toISOString(),
          convite_token: null,
          user_id: userId,
        })
        .eq("id", lojista.id);

      // Garantir vínculo em lojista_usuarios (compat com guard atual)
      const { data: existing } = await admin
        .from("lojista_usuarios")
        .select("id")
        .eq("lojista_id", lojista.id)
        .eq("email", lojista.email.toLowerCase())
        .maybeSingle();

      if (existing) {
        await admin
          .from("lojista_usuarios")
          .update({ user_id: userId, ativo: true })
          .eq("id", existing.id);
      } else {
        await admin.from("lojista_usuarios").insert({
          lojista_id: lojista.id,
          user_id: userId,
          nome: lojista.nome,
          email: lojista.email.toLowerCase(),
          ativo: true,
        });
      }
    }

    return json({
      ok: true,
      action_link: actionLink,
      redirect_to: redirectTo,
    });
  } catch (err: any) {
    console.error("[accept-lojista-invite] unexpected:", err);
    return json({
      ok: false,
      code: "unexpected_error",
      message: "Erro inesperado. Atualize a página ou contate a assistência.",
    });
  }
});
