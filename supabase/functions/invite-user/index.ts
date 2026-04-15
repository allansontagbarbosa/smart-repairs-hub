import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin
    const { data: isAdmin } = await adminClient.rpc("is_admin_user", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem convidar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller's empresa_id
    const { data: callerProfile } = await adminClient
      .from("user_profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .single();

    const empresa_id = callerProfile?.empresa_id;
    if (!empresa_id) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada para o usuário" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, nome, perfil_id } = await req.json();

    if (!email || !nome) {
      return new Response(JSON.stringify({ error: "Email e nome são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || supabaseUrl;

    // Invite user via admin API
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: nome, perfil_id, empresa_id },
      redirectTo: `${origin}/aceitar-convite`,
    });

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user_profiles + funcionario for invited user
    if (inviteData?.user) {
      const { data: func } = await adminClient.from("funcionarios").insert({
        nome,
        email,
        empresa_id,
        cargo: "Colaborador",
        ativo: true,
      }).select("id").single();

      await adminClient.from("user_profiles").upsert({
        user_id: inviteData.user.id,
        nome_exibicao: nome,
        perfil_id: perfil_id || null,
        empresa_id,
        funcionario_id: func?.id || null,
        ativo: true,
      }, { onConflict: "user_id" });
    }

    return new Response(JSON.stringify({ success: true, user_id: inviteData?.user?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Invite error:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
