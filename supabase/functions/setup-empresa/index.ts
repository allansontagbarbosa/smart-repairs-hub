import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's token to get user info
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for all DB operations (bypasses RLS)
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { nomeEmpresa, cnpj, telefone, email } = body;

    if (!nomeEmpresa?.trim()) {
      return new Response(JSON.stringify({ error: "Nome da empresa é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already has empresa
    const { data: existingProfile } = await admin
      .from("user_profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingProfile?.empresa_id) {
      return new Response(JSON.stringify({ error: "Usuário já possui empresa" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slug = nomeEmpresa
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      + "-" + Date.now().toString(36);

    // STEP 1 — Create empresa
    const { data: empresa, error: errEmpresa } = await admin
      .from("empresas")
      .insert({
        nome: nomeEmpresa.trim(),
        slug,
        cnpj: cnpj?.trim() || null,
        telefone: telefone?.trim() || null,
        email: email?.trim() || user.email,
        plano: "basico",
        owner_id: user.id,
      })
      .select()
      .single();

    if (errEmpresa) throw errEmpresa;

    // STEP 2 — Create Administrador profile
    const { data: perfil, error: errPerfil } = await admin
      .from("perfis_acesso")
      .insert({
        empresa_id: empresa.id,
        nome_perfil: "Administrador",
        descricao: "Acesso total ao sistema",
        permissoes: {
          dashboard: true,
          assistencia: { ver: true, criar: true, editar: true, excluir: true },
          financeiro: { ver: true, criar: true, editar: true, excluir: true },
          pecas: { ver: true, criar: true, editar: true, excluir: true },
          clientes: { ver: true, criar: true, editar: true, excluir: true },
          relatorios: true,
          configuracoes: true,
          fila_ia: true,
        },
      })
      .select()
      .single();

    if (errPerfil) throw errPerfil;

    // STEP 3 — Create funcionario
    const { data: func, error: errFunc } = await admin
      .from("funcionarios")
      .insert({
        empresa_id: empresa.id,
        nome: user.user_metadata?.full_name || user.email || "Administrador",
        email: user.email,
        cargo: "Administrador",
        funcao: "Administrador",
        ativo: true,
      })
      .select("id")
      .single();

    if (errFunc) throw errFunc;

    // STEP 4 — Link user_profile to empresa
    const { error: errProfile } = await admin
      .from("user_profiles")
      .update({
        empresa_id: empresa.id,
        perfil_id: perfil.id,
        funcionario_id: func.id,
      })
      .eq("user_id", user.id);

    if (errProfile) throw errProfile;

    // STEP 5 — Create empresa_config
    await admin.from("empresa_config").insert({
      empresa_id: empresa.id,
      nome: nomeEmpresa.trim(),
      gastos_fixos_mensais: 0,
    });

    // STEP 6 — Create default profiles
    await admin.from("perfis_acesso").insert([
      {
        empresa_id: empresa.id,
        nome_perfil: "Técnico",
        descricao: "Ordens de serviço e estoque",
        permissoes: { dashboard: true, assistencia: { ver: true, criar: true, editar: true, excluir: false }, financeiro: { ver: false, criar: false, editar: false, excluir: false }, pecas: { ver: true, criar: false, editar: false, excluir: false }, clientes: { ver: true, criar: false, editar: false, excluir: false }, relatorios: false, configuracoes: false, fila_ia: true },
      },
      {
        empresa_id: empresa.id,
        nome_perfil: "Financeiro",
        descricao: "Módulo financeiro e relatórios",
        permissoes: { dashboard: true, assistencia: { ver: true, criar: false, editar: false, excluir: false }, financeiro: { ver: true, criar: true, editar: true, excluir: false }, pecas: { ver: true, criar: true, editar: true, excluir: false }, clientes: { ver: true, criar: false, editar: false, excluir: false }, relatorios: true, configuracoes: false, fila_ia: false },
      },
      {
        empresa_id: empresa.id,
        nome_perfil: "Atendimento",
        descricao: "Cadastro de OS e clientes",
        permissoes: { dashboard: true, assistencia: { ver: true, criar: true, editar: true, excluir: false }, financeiro: { ver: false, criar: false, editar: false, excluir: false }, pecas: { ver: true, criar: false, editar: false, excluir: false }, clientes: { ver: true, criar: true, editar: true, excluir: false }, relatorios: false, configuracoes: false, fila_ia: false },
      },
      {
        empresa_id: empresa.id,
        nome_perfil: "Gerente",
        descricao: "Visão gerencial e aprovações",
        permissoes: { dashboard: true, assistencia: { ver: true, criar: false, editar: false, excluir: false }, financeiro: { ver: true, criar: false, editar: false, excluir: false }, pecas: { ver: true, criar: false, editar: false, excluir: false }, clientes: { ver: true, criar: false, editar: false, excluir: false }, relatorios: true, configuracoes: false, fila_ia: false },
      },
    ]);

    return new Response(JSON.stringify({ success: true, empresa_id: empresa.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Onboarding error:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
