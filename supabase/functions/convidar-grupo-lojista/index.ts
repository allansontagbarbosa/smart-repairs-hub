import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ sucesso: false, erro: "Não autorizado" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const APP_URL = Deno.env.get("APP_URL") ?? "https://ditt.com.br";

    const { grupo_id } = await req.json().catch(() => ({}));
    if (!grupo_id) return json({ sucesso: false, erro: "grupo_id obrigatório" }, 400);

    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabaseUser.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ sucesso: false, erro: "Não autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: grupo, error: grupoErr } = await admin
      .from("lojista_grupos")
      .select("*")
      .eq("id", grupo_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (grupoErr || !grupo) return json({ sucesso: false, erro: "Grupo não encontrado" }, 404);
    if (!grupo.email) return json({ sucesso: false, erro: "Grupo precisa de email para enviar convite" }, 400);

    const { data: perfil } = await admin
      .from("user_profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!perfil || perfil.empresa_id !== grupo.empresa_id) {
      return json({ sucesso: false, erro: "Sem permissão para esse grupo" }, 403);
    }

    // Procura user existente por email (paginado)
    let existing: { id: string; email?: string } | undefined;
    let page = 1;
    while (page < 20) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (listErr) break;
      existing = list?.users?.find((u: any) => (u.email ?? "").toLowerCase() === grupo.email.toLowerCase());
      if (existing || !list?.users || list.users.length < 200) break;
      page++;
    }

    let userId: string;

    const redirectTo = `${APP_URL}/lojista/login`;
    const metadata = {
      tipo: "grupo_lojista",
      grupo_id: grupo.id,
      grupo_nome: grupo.nome,
      empresa_id: grupo.empresa_id,
    };

    if (existing) {
      userId = existing.id;
      // Atualiza metadata e reenvia link de recuperação
      await admin.auth.admin.updateUserById(userId, { user_metadata: metadata });
      const { error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: grupo.email,
        options: { redirectTo },
      });
      if (linkErr) console.warn("generateLink recovery:", linkErr.message);
    } else {
      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(grupo.email, {
        redirectTo,
        data: metadata,
      });
      if (inviteErr) return json({ sucesso: false, erro: `Falha ao convidar: ${inviteErr.message}` }, 500);
      userId = invited?.user?.id ?? "";
    }

    const conviteToken = crypto.randomUUID();
    const { error: updateErr } = await admin
      .from("lojista_grupos")
      .update({
        user_id: userId,
        status_acesso: "convidado",
        convite_enviado_em: new Date().toISOString(),
        convite_token: conviteToken,
        convite_expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", grupo_id);

    if (updateErr) return json({ sucesso: false, erro: updateErr.message }, 500);

    return json({
      sucesso: true,
      mensagem: `Convite enviado para ${grupo.email}`,
      user_id: userId,
      reenvio: !!existing,
    });
  } catch (e) {
    console.error("[convidar-grupo-lojista]", e);
    return json({ sucesso: false, erro: e instanceof Error ? e.message : "erro desconhecido" }, 500);
  }
});
