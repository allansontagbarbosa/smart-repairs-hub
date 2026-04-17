// Edge function: accept-lojista-invite
// Aceita o convite por token, cria/recupera o auth user e gera magic link de 1 clique
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

    const body = await req.json().catch(() => ({}));
    const token: string | undefined = body?.token;
    const action: string = body?.action ?? "validate"; // validate | accept

    if (!token) {
      return new Response(JSON.stringify({ error: "token obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: lojista, error: lErr } = await admin
      .from("lojistas")
      .select("id, nome, email, status_acesso, convite_token, convite_enviado_em, empresa_id")
      .eq("convite_token", token)
      .maybeSingle();

    if (lErr || !lojista) {
      return new Response(JSON.stringify({ error: "Convite inválido ou expirado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validar expiração: 7 dias
    if (lojista.convite_enviado_em) {
      const enviado = new Date(lojista.convite_enviado_em).getTime();
      const agora = Date.now();
      const diasMs = 7 * 24 * 60 * 60 * 1000;
      if (agora - enviado > diasMs) {
        return new Response(JSON.stringify({ error: "Convite expirado. Solicite um novo." }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!lojista.email) {
      return new Response(JSON.stringify({ error: "Lojista sem email cadastrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      return new Response(
        JSON.stringify({
          ok: true,
          lojista: { id: lojista.id, nome: lojista.nome, email: lojista.email },
          empresa_nome: empresaNome,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
      return new Response(JSON.stringify({ error: linkErr?.message ?? "Falha ao gerar link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

      // Garantir vínculo em lojista_usuarios (para compatibilidade com guard atual)
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

    return new Response(
      JSON.stringify({
        ok: true,
        action_link: actionLink,
        redirect_to: redirectTo,
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
