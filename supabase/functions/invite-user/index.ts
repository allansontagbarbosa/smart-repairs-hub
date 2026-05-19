import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("[invite-user] getClaims falhou:", claimsError);
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: claimsData.claims.sub as string };

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin
    const { data: isAdmin } = await adminClient.rpc("is_admin_user", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem convidar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email: emailRaw, nome, perfil_id, empresa_id, dados_rh } = await req.json();
    const email = (emailRaw || "").trim().toLowerCase();

    // IU-01: mapear cargo do funcionário a partir do perfil de acesso
    let cargoFuncionario = "Colaborador";
    let nomePerfilOriginal = "";
    if (perfil_id) {
      const { data: perfilData } = await adminClient
        .from("perfis_acesso")
        .select("nome_perfil")
        .eq("id", perfil_id)
        .maybeSingle();
      if (perfilData?.nome_perfil) {
        cargoFuncionario = perfilData.nome_perfil;
        nomePerfilOriginal = perfilData.nome_perfil;
      }
    }

    // Perfis operacionais que tipicamente são CLT — marcam eh_funcionario_rh
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const perfisCLT = ["tecnico", "atendimento", "gerente", "financeiro"];
    const ehFuncionarioRH = perfisCLT.includes(norm(nomePerfilOriginal));

    // Campos CLT opcionais vindos do modal (somente se eh_funcionario_rh)
    const dadosRHExtras = (ehFuncionarioRH && dados_rh && typeof dados_rh === "object") ? {
      cpf: dados_rh.cpf || null,
      telefone: dados_rh.telefone || null,
      cargo: dados_rh.cargo || cargoFuncionario,
      tipo_vinculo: dados_rh.tipo_vinculo || "clt",
      salario_centavos: dados_rh.salario_centavos ?? null,
      data_admissao: dados_rh.data_admissao || null,
      carga_horaria_semanal: dados_rh.carga_horaria_semanal ?? null,
    } : {};

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

    // === NOVA CHECAGEM: bloquear convites por usuários sem permissão admin ===
    const { data: callerRoleData, error: roleErr } = await userClient.rpc("get_my_role");

    if (roleErr) {
      console.error("[invite-user] erro ao validar role:", roleErr);
      return new Response(JSON.stringify({ error: "Falha ao validar permissão" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const roleNorm = String(callerRoleData ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const podeConvidar = roleNorm.startsWith("admin") || roleNorm.startsWith("gerente");

    if (!podeConvidar) {
      console.warn("[invite-user] tentativa de convite por role insuficiente:", callerRoleData);
      return new Response(JSON.stringify({
        error: "Apenas administradores e gerentes podem convidar usuários",
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gerente não pode criar Administrador
    if (roleNorm.startsWith("gerente") && perfil_id) {
      const { data: perfilAlvo } = await adminClient
        .from("perfis_acesso")
        .select("nome_perfil")
        .eq("id", perfil_id)
        .single();

      const perfilAlvoNorm = String(perfilAlvo?.nome_perfil ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      if (perfilAlvoNorm.startsWith("admin")) {
        return new Response(JSON.stringify({
          error: "Gerente não pode convidar Administrador",
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // === FIM da nova checagem ===

    // Rate-limit: 20 convites por admin em 60min
    const { data: rateData } = await userClient.rpc("checar_rate_limit", {
      p_acao: "invite_user",
      p_identificador: "user=" + user.id,
      p_max_tentativas: 20,
      p_janela_segundos: 3600,
    });
    const rate = rateData as any;
    if (rate && !rate.allowed) {
      return new Response(JSON.stringify({
        error: `Limite de convites atingido. Aguarde ${rate.retry_after_seconds}s.`,
        retry_after_seconds: rate.retry_after_seconds,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (empresa_id !== callerEmpresaId) {
      return new Response(JSON.stringify({ error: "Empresa inválida para este convite" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const siteUrl = Deno.env.get("SITE_URL") || "https://ditt.com.br";

    // === Idempotência: já existe funcionário com este email na empresa? ===
    const { data: funcExistente } = await adminClient
      .from("funcionarios")
      .select("id, nome, ativo, deleted_at")
      .eq("empresa_id", empresa_id)
      .ilike("email", email)
      .is("deleted_at", null)
      .maybeSingle();

    if (funcExistente) {
      console.log("[invite-user] Funcionário já existe na empresa:", funcExistente.id);
    }

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
        const existingUser = existingUsers?.users?.find(
          (u: any) => u.email?.toLowerCase() === email
        );

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
          // User existe no auth, mas sem user_profiles. Reutilizar funcionário existente
          // (se houver) em vez de criar duplicado.
          let funcionarioId: string | null = funcExistente?.id ?? null;

          if (!funcionarioId) {
            const { data: func } = await adminClient.from("funcionarios").insert({
              nome, email, empresa_id, cargo: cargoFuncionario, funcao: cargoFuncionario, ativo: true,
              eh_funcionario_rh: ehFuncionarioRH,
              ...dadosRHExtras,
            }).select("id").single();
            funcionarioId = func?.id ?? null;
          } else {
            console.log("[invite-user] Reusando funcionário existente:", funcionarioId);
          }

          await adminClient.from("user_profiles").insert({
            user_id: targetUserId,
            nome_exibicao: nome,
            perfil_id: perfil_id || null,
            empresa_id,
            funcionario_id: funcionarioId,
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
        let funcionarioId: string | null = funcExistente?.id ?? null;

        if (!funcionarioId) {
          const { data: func } = await adminClient.from("funcionarios").insert({
            nome, email, empresa_id, cargo: cargoFuncionario, funcao: cargoFuncionario, ativo: true,
            eh_funcionario_rh: ehFuncionarioRH,
            ...dadosRHExtras,
          }).select("id").single();
          funcionarioId = func?.id ?? null;
        }

        await adminClient.from("user_profiles").upsert({
          user_id: targetUserId,
          nome_exibicao: nome,
          perfil_id: perfil_id || null,
          empresa_id,
          funcionario_id: funcionarioId,
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
