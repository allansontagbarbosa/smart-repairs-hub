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

    const { email, nome, perfil_id, empresa_id } = await req.json();

    if (!email || !nome || !empresa_id) {
      return new Response(JSON.stringify({ error: "Email, nome e empresa_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller's empresa_id
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("user_profiles")
      .select("empresa_id")
      .or(`user_id.eq.${user.id},id.eq.${user.id}`)
      .maybeSingle();

    if (callerProfileError) {
      return new Response(JSON.stringify({ error: "Não foi possível validar a empresa do usuário" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerEmpresaId = callerProfile?.empresa_id;
    if (!callerEmpresaId) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada para o usuário" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (empresa_id !== callerEmpresaId) {
      return new Response(JSON.stringify({ error: "Empresa inválida para este convite" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const siteUrl = Deno.env.get("SITE_URL") || "https://mobilefix.dev";

    // Invite user via admin API
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: nome, perfil_id, empresa_id },
      redirectTo: `${siteUrl}/aceitar-convite`,
    });

    let targetUserId: string | undefined;

    if (inviteError) {
      // If user already exists, look them up and reactivate their profile
      if (inviteError.message.includes("already been registered")) {
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find((u: any) => u.email === email);

        if (!existingUser) {
          return new Response(JSON.stringify({ error: "Usuário existe mas não foi possível localizá-lo" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        targetUserId = existingUser.id;

        // Reactivate existing profile or create one
        const { data: existingProfile } = await adminClient
          .from("user_profiles")
          .select("id")
          .or(`user_id.eq.${targetUserId},id.eq.${targetUserId}`)
          .maybeSingle();

        if (existingProfile) {
          await adminClient.from("user_profiles").update({
            ativo: true,
            perfil_id: perfil_id || null,
            empresa_id,
            nome_exibicao: nome,
          }).eq("id", existingProfile.id);
        } else {
          // Create funcionario + profile for existing auth user
          const { data: func } = await adminClient.from("funcionarios").insert({
            nome, email, empresa_id, cargo: "Colaborador", ativo: true,
          }).select("id").single();

          await adminClient.from("user_profiles").insert({
            user_id: targetUserId,
            nome_exibicao: nome,
            perfil_id: perfil_id || null,
            empresa_id,
            funcionario_id: func?.id || null,
            ativo: true,
          });
        }

        // Reenviar email de convite para o usuário existente
        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
          type: "invite",
          email: email,
          options: {
            data: { full_name: nome, perfil_id, empresa_id },
            redirectTo: `${siteUrl}/aceitar-convite`,
          },
        });

        // Se não conseguir gerar link de convite, tentar recovery como fallback
        if (linkError) {
          await adminClient.auth.admin.generateLink({
            type: "recovery",
            email: email,
            options: { redirectTo: `${siteUrl}/aceitar-convite` },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: inviteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // New user invited successfully — create profile + funcionario
      targetUserId = inviteData?.user?.id;
      if (targetUserId) {
        const { data: func } = await adminClient.from("funcionarios").insert({
          nome, email, empresa_id, cargo: "Colaborador", ativo: true,
        }).select("id").single();

        await adminClient.from("user_profiles").upsert({
          user_id: targetUserId,
          nome_exibicao: nome,
          perfil_id: perfil_id || null,
          empresa_id,
          funcionario_id: func?.id || null,
          ativo: true,
        }, { onConflict: "user_id" });
      }
    }

    return new Response(JSON.stringify({ success: true, user_id: targetUserId }), {
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
