import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type ErrorCode =
  | "INVALID_PAYLOAD"
  | "NOT_AUTHORIZED"
  | "NOT_FOUND"
  | "ALREADY_HAS_LOGIN"
  | "EMAIL_EXISTS"
  | "PROFILE_CREATE_FAILED"
  | "FUNCIONARIO_UPDATE_FAILED"
  | "USER_CREATE_FAILED"
  | "INTERNAL_ERROR";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(code: ErrorCode, message: string, status = 400, details?: unknown) {
  return jsonResponse({ success: false, code, message, details }, status);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("INVALID_PAYLOAD", "Método não permitido", 405);
  }

  let createdUserId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("NOT_AUTHORIZED", "Não autorizado", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return errorResponse("INTERNAL_ERROR", "Configuração da função incompleta", 500);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return errorResponse("NOT_AUTHORIZED", "Sessão inválida", 401);
    }

    const payload = await req.json().catch(() => null);
    const funcionario_id = payload?.funcionario_id;
    const perfil_id = payload?.perfil_id;
    const empresa_id = payload?.empresa_id;
    const email = normalizeEmail(payload?.email);
    const password = typeof payload?.password === "string" ? payload.password : "";

    if (!isUuid(funcionario_id) || !isUuid(perfil_id) || !isUuid(empresa_id) || !email || password.length < 6) {
      return errorResponse("INVALID_PAYLOAD", "Payload inválido");
    }

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("user_profiles")
      .select("empresa_id, ativo, perfis_acesso!inner(nome_perfil)")
      .eq("user_id", caller.id)
      .eq("empresa_id", empresa_id)
      .eq("ativo", true)
      .maybeSingle();

    if (callerProfileError) {
      return errorResponse("NOT_AUTHORIZED", "Não foi possível validar permissões", 403, callerProfileError.message);
    }

    const callerRole = (callerProfile?.perfis_acesso as { nome_perfil?: string } | null)?.nome_perfil;
    if (!callerProfile || !["Administrador", "admin"].includes(callerRole ?? "")) {
      return errorResponse("NOT_AUTHORIZED", "Apenas administradores da empresa podem vincular login a funcionário", 403);
    }

    const { data: funcionario, error: funcionarioError } = await adminClient
      .from("funcionarios")
      .select("id, nome, email, ativo, empresa_id")
      .eq("id", funcionario_id)
      .eq("empresa_id", empresa_id)
      .eq("ativo", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (funcionarioError) {
      return errorResponse("NOT_FOUND", "Erro ao validar funcionário", 400, funcionarioError.message);
    }
    if (!funcionario) {
      return errorResponse("NOT_FOUND", "Funcionário ativo não encontrado para esta empresa", 404);
    }

    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from("user_profiles")
      .select("id, user_id")
      .eq("funcionario_id", funcionario_id)
      .maybeSingle();

    if (existingProfileError) {
      return errorResponse("INTERNAL_ERROR", "Erro ao verificar login existente", 500, existingProfileError.message);
    }
    if (existingProfile) {
      return errorResponse("ALREADY_HAS_LOGIN", "Funcionário já possui login vinculado", 409, existingProfile);
    }

    const { data: existingUsers, error: listUsersError } = await adminClient.auth.admin.listUsers();
    if (listUsersError) {
      return errorResponse("INTERNAL_ERROR", "Erro ao verificar email existente", 500, listUsersError.message);
    }
    const emailExists = existingUsers.users.some((u) => u.email?.toLowerCase() === email);
    if (emailExists) {
      return errorResponse("EMAIL_EXISTS", "Email já existe no sistema", 409);
    }

    const { data: funcionarioEmailExists, error: funcionarioEmailError } = await adminClient
      .from("funcionarios")
      .select("id, nome, email")
      .eq("email", email)
      .neq("id", funcionario_id)
      .maybeSingle();

    if (funcionarioEmailError) {
      return errorResponse("INTERNAL_ERROR", "Erro ao verificar email em funcionários", 500, funcionarioEmailError.message);
    }
    if (funcionarioEmailExists) {
      return errorResponse("EMAIL_EXISTS", "Email já está em uso por outro funcionário", 409, funcionarioEmailExists);
    }

    const { data: perfil, error: perfilError } = await adminClient
      .from("perfis_acesso")
      .select("id, nome_perfil, empresa_id")
      .eq("id", perfil_id)
      .eq("empresa_id", empresa_id)
      .maybeSingle();

    if (perfilError) {
      return errorResponse("NOT_FOUND", "Erro ao validar perfil", 400, perfilError.message);
    }
    if (!perfil) {
      return errorResponse("NOT_FOUND", "Perfil não encontrado para esta empresa", 404);
    }

    const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: funcionario.nome,
        empresa_id,
        perfil_id,
        funcionario_id,
      },
    });

    if (createUserError || !createdUser.user) {
      return errorResponse("USER_CREATE_FAILED", "Erro ao criar usuário", 400, createUserError?.message);
    }

    createdUserId = createdUser.user.id;

    const { data: profile, error: profileError } = await adminClient
      .from("user_profiles")
      .insert({
        user_id: createdUserId,
        funcionario_id,
        perfil_id,
        empresa_id,
        nome_exibicao: funcionario.nome,
        ativo: true,
      })
      .select("id, user_id, funcionario_id, perfil_id, empresa_id")
      .single();

    if (profileError || !profile) {
      await adminClient.auth.admin.deleteUser(createdUserId);
      createdUserId = null;
      return errorResponse("PROFILE_CREATE_FAILED", "Usuário criado, mas falhou ao criar perfil; rollback executado", 500, profileError?.message);
    }

    if (!funcionario.email) {
      const { error: updateFuncionarioError } = await adminClient
        .from("funcionarios")
        .update({ email })
        .eq("id", funcionario_id)
        .is("email", null);

      if (updateFuncionarioError) {
        await adminClient.from("user_profiles").delete().eq("id", profile.id);
        await adminClient.auth.admin.deleteUser(createdUserId);
        createdUserId = null;
        return errorResponse("FUNCIONARIO_UPDATE_FAILED", "Falha ao atualizar email do funcionário; rollback executado", 500, updateFuncionarioError.message);
      }
    }

    return jsonResponse({
      success: true,
      user_id: createdUserId,
      user_profile_id: profile.id,
      message: "Login vinculado ao funcionário existente com sucesso",
    });
  } catch (err) {
    if (createdUserId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        await adminClient.auth.admin.deleteUser(createdUserId);
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr);
      }
    }

    console.error("link-existing-funcionario error:", err);
    return errorResponse("INTERNAL_ERROR", "Erro interno do servidor", 500, err instanceof Error ? err.message : String(err));
  }
});
