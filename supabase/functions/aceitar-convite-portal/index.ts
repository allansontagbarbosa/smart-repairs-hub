import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  token: string;
  password: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { token, password }: Payload = await req.json();

    if (!token || !password) {
      return json({ success: false, error: "Token e senha são obrigatórios" }, 400);
    }
    if (password.length < 8) {
      return json({ success: false, error: "Senha deve ter no mínimo 8 caracteres" }, 400);
    }
    if (!/[0-9]/.test(password) || !/[A-Za-z]/.test(password)) {
      return json({ success: false, error: "Senha deve conter pelo menos uma letra e um número" }, 400);
    }

    const { data: cliente, error: errCli } = await supabase
      .from("clientes")
      .select("id, nome, email, empresa_id, status_convite, convite_expira_em, user_id, tipo_cliente")
      .eq("convite_token", token)
      .is("deleted_at", null)
      .maybeSingle();

    if (errCli || !cliente) {
      return json({ success: false, error: "Convite inválido" }, 404);
    }
    if (cliente.user_id) {
      return json({ success: false, error: "Convite já foi aceito. Faça login normalmente." }, 400);
    }
    if (cliente.status_convite !== "pendente") {
      return json({ success: false, error: "Convite não está mais pendente" }, 400);
    }
    if (new Date(cliente.convite_expira_em) < new Date()) {
      return json({ success: false, error: "Convite expirou. Solicite um novo." }, 400);
    }
    if (!cliente.email) {
      return json({ success: false, error: "Cliente sem email cadastrado" }, 400);
    }
    if (cliente.tipo_cliente !== "lojista_b2b") {
      return json({ success: false, error: "Convite inválido para este tipo de cliente" }, 400);
    }

    const { data: usersList } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const existing = usersList?.users?.find(
      (u) => u.email?.toLowerCase() === cliente.email!.toLowerCase()
    );

    let userId: string;

    if (existing) {
      const { data: updated, error: errUpd } = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (errUpd || !updated.user) {
        return json({ success: false, error: `Erro ao atualizar usuário: ${errUpd?.message}` }, 500);
      }
      userId = updated.user.id;
    } else {
      const { data: created, error: errCreate } = await supabase.auth.admin.createUser({
        email: cliente.email,
        password,
        email_confirm: true,
        user_metadata: {
          cliente_id: cliente.id,
          nome: cliente.nome,
          origem: "convite_portal_b2b",
        },
      });
      if (errCreate || !created.user) {
        return json({ success: false, error: `Erro ao criar usuário: ${errCreate?.message}` }, 500);
      }
      userId = created.user.id;
    }

    const { error: errLink } = await supabase
      .from("clientes")
      .update({
        user_id: userId,
        status_convite: "aceito",
        convite_aceito_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", cliente.id);

    if (errLink) {
      if (!existing) {
        await supabase.auth.admin.deleteUser(userId);
      }
      return json({ success: false, error: `Erro ao vincular: ${errLink.message}` }, 500);
    }

    const supabaseAnon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: sessionData, error: errSession } = await supabaseAnon.auth.signInWithPassword({
      email: cliente.email,
      password,
    });

    if (errSession || !sessionData.session) {
      return json({
        success: true,
        cliente_id: cliente.id,
        cliente_nome: cliente.nome,
        autologin: false,
        message: "Conta criada. Faça login com seu email e senha.",
      });
    }

    return json({
      success: true,
      cliente_id: cliente.id,
      cliente_nome: cliente.nome,
      autologin: true,
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at,
      },
    });
  } catch (e) {
    console.error("aceitar-convite-portal error:", e);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
