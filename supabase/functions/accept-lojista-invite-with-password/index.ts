// Edge function: accept-lojista-invite-with-password
// Valida token e cria/atualiza auth user com senha. Retorna sessão pronta
// para o frontend usar com supabase.auth.setSession().
// SEMPRE responde 200 com payload { ok, code, message } para evitar que o
// SDK do Supabase descarte o body em status não-2xx.
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
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const body = await req.json().catch(() => ({}));
    const tokenRaw: string | undefined = body?.token;
    const token = typeof tokenRaw === "string" ? tokenRaw.trim() : "";
    const senha: string = typeof body?.senha === "string" ? body.senha : "";

    if (!token) {
      return json({ ok: false, code: "token_missing", message: "Token ausente." });
    }
    if (!senha || senha.length < 8) {
      return json({
        ok: false,
        code: "weak_password",
        message: "A senha deve ter no mínimo 8 caracteres.",
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: lojista, error: lErr } = await admin
      .from("lojistas")
      .select("id, nome, email, status_acesso, convite_token, convite_enviado_em, convite_aceito_em, empresa_id")
      .eq("convite_token", token)
      .maybeSingle();

    if (lErr) {
      console.error("[accept-with-password] db error:", lErr);
      return json({ ok: false, code: "db_error", message: "Erro ao consultar convite." });
    }

    if (!lojista) {
      return json({
        ok: false,
        code: "token_not_found",
        message:
          "Este convite não é mais válido. Pode ter sido aceito ou substituído por um novo.",
      });
    }

    // Expiração 7 dias
    if (lojista.convite_enviado_em) {
      const enviado = new Date(lojista.convite_enviado_em).getTime();
      const diasMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - enviado > diasMs) {
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

    const emailLower = lojista.email.toLowerCase();

    // 1) Tentar criar o auth user. Se já existir, capturar e atualizar a senha.
    let userId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: emailLower,
      password: senha,
      email_confirm: true,
    });

    if (createErr) {
      const msg = (createErr.message || "").toLowerCase();
      const alreadyExists =
        msg.includes("already") || msg.includes("registered") || msg.includes("exists");
      if (!alreadyExists) {
        console.error("[accept-with-password] createUser error:", createErr);
        return json({
          ok: false,
          code: "create_user_failed",
          message: "Não foi possível criar o usuário. Tente novamente em instantes.",
        });
      }

      // Localizar user existente por email — listUsers paginated
      let existingId: string | null = null;
      let page = 1;
      while (page < 20 && !existingId) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (listErr) {
          console.error("[accept-with-password] listUsers error:", listErr);
          break;
        }
        const found = list.users.find((u) => (u.email || "").toLowerCase() === emailLower);
        if (found) {
          existingId = found.id;
          break;
        }
        if (list.users.length < 200) break;
        page += 1;
      }

      if (!existingId) {
        return json({
          ok: false,
          code: "user_not_found",
          message: "Email já existe no sistema mas não foi possível localizá-lo.",
        });
      }

      const { error: updErr } = await admin.auth.admin.updateUserById(existingId, {
        password: senha,
        email_confirm: true,
      });
      if (updErr) {
        console.error("[accept-with-password] updateUserById error:", updErr);
        return json({
          ok: false,
          code: "update_user_failed",
          message: "Não foi possível definir a senha. Tente novamente.",
        });
      }
      userId = existingId;
    } else {
      userId = created.user?.id ?? null;
    }

    if (!userId) {
      return json({
        ok: false,
        code: "no_user_id",
        message: "Falha ao identificar usuário criado.",
      });
    }

    // 2) Atualizar lojista — ativo, vincular user_id, limpar token
    console.log("[accept-with-password] antes do update lojistas:", {
      userId,
      lojistaId: lojista.id,
      email: emailLower,
    });

    const { data: updatedLojista, error: updLojistaErr } = await admin
      .from("lojistas")
      .update({
        status_acesso: "ativo",
        convite_aceito_em: new Date().toISOString(),
        convite_token: null,
        user_id: userId,
      })
      .eq("id", lojista.id)
      .select()
      .single();

    if (updLojistaErr) {
      console.error("[accept-with-password] UPDATE lojistas FALHOU:", updLojistaErr);
      return json({
        ok: false,
        code: "update_lojista_failed",
        message: "Falha ao ativar cadastro: " + updLojistaErr.message,
      });
    }

    console.log("[accept-with-password] UPDATE lojistas OK:", {
      id: updatedLojista?.id,
      status_acesso: updatedLojista?.status_acesso,
      user_id: updatedLojista?.user_id,
    });

    if (!updatedLojista?.user_id || updatedLojista?.status_acesso !== "ativo") {
      console.error("[accept-with-password] Update lojistas não persistiu:", updatedLojista);
      return json({
        ok: false,
        code: "lojista_not_active",
        message: "Cadastro não foi ativado corretamente.",
      });
    }

    // 3) Garantir vínculo em lojista_usuarios
    const { data: existingLU } = await admin
      .from("lojista_usuarios")
      .select("id")
      .eq("lojista_id", lojista.id)
      .eq("email", emailLower)
      .maybeSingle();

    if (existingLU) {
      await admin
        .from("lojista_usuarios")
        .update({ user_id: userId, ativo: true })
        .eq("id", existingLU.id);
    } else {
      await admin.from("lojista_usuarios").insert({
        lojista_id: lojista.id,
        user_id: userId,
        nome: lojista.nome,
        email: emailLower,
        ativo: true,
      });
    }

    // 4) Gerar sessão fazendo login com a senha recém-definida (cliente público)
    const publicClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: signInData, error: signInErr } =
      await publicClient.auth.signInWithPassword({
        email: emailLower,
        password: senha,
      });

    if (signInErr || !signInData?.session) {
      console.error("[accept-with-password] signIn error:", signInErr);
      // Mesmo sem sessão, o usuário pode logar manualmente — devolver ok parcial
      return json({
        ok: true,
        code: "user_created_no_session",
        message: "Acesso criado. Faça login com seu email e senha.",
      });
    }

    return json({
      ok: true,
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      },
    });
  } catch (err: any) {
    console.error("[accept-with-password] unexpected:", err);
    return json({
      ok: false,
      code: "unexpected_error",
      message: "Erro inesperado. Atualize a página ou contate a assistência.",
    });
  }
});
