import { getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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

    // Rate-limit: 1 empresa por usuário a cada 24h
    const { data: rateData } = await userClient.rpc("checar_rate_limit", {
      p_acao: "setup_empresa",
      p_identificador: "user=" + user.id,
      p_max_tentativas: 1,
      p_janela_segundos: 86400,
    });
    const rate = rateData as any;
    if (rate && !rate.allowed) {
      return new Response(JSON.stringify({
        error: "Limite de criação de empresas atingido. Tente novamente em 24h.",
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { nomeEmpresa, cnpj, telefone, email, plano } = body;

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
      .or(`user_id.eq.${user.id},id.eq.${user.id}`)
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

    // SE-03: rollback manual — rastreia recursos criados e desfaz tudo se algo falhar
    let createdEmpresaId: string | null = null;
    let createdPerfilId: string | null = null;
    let createdFuncId: string | null = null;

    try {
      // STEP 1 — Create empresa
      const { data: empresa, error: errEmpresa } = await admin
        .from("empresas")
        .insert({
          nome: nomeEmpresa.trim(),
          slug,
          cnpj: cnpj?.trim() || null,
          telefone: telefone?.trim() || null,
          email: email?.trim() || user.email,
          plano: plano || "basico",
          owner_id: user.id,
        })
        .select()
        .single();

      if (errEmpresa) throw errEmpresa;
      createdEmpresaId = empresa.id;

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
      createdPerfilId = perfil.id;

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
      createdFuncId = func.id;

      // STEP 4 — Link user_profile to empresa
      const { error: errProfile } = await admin
        .from("user_profiles")
        .upsert({
          user_id: user.id,
          nome_exibicao: user.user_metadata?.full_name || user.email || "Administrador",
          empresa_id: empresa.id,
          perfil_id: perfil.id,
          funcionario_id: func.id,
          ativo: true,
        }, { onConflict: "user_id" });

      if (errProfile) throw errProfile;

      // STEP 5 — Create empresa_config
      const { error: errConfig } = await admin.from("empresa_config").insert({
        empresa_id: empresa.id,
        nome: nomeEmpresa.trim(),
        gastos_fixos_mensais: 0,
      });
      if (errConfig) throw errConfig;

      // STEP 6 — Create default profiles
      const { error: errPerfis } = await admin.from("perfis_acesso").insert([
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
      if (errPerfis) throw errPerfis;

      return new Response(JSON.stringify({ success: true, empresa_id: empresa.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (stepErr: any) {
      // ROLLBACK manual: limpa recursos criados na ordem inversa
      console.error("Setup empresa falhou, executando rollback:", stepErr);
      try {
        if (createdEmpresaId) {
          await admin.from("user_profiles")
            .update({ empresa_id: null, perfil_id: null, funcionario_id: null })
            .eq("user_id", user.id);
        }
        if (createdFuncId) await admin.from("funcionarios").delete().eq("id", createdFuncId);
        if (createdEmpresaId) {
          await admin.from("empresa_config").delete().eq("empresa_id", createdEmpresaId);
          await admin.from("perfis_acesso").delete().eq("empresa_id", createdEmpresaId);
          await admin.from("empresas").delete().eq("id", createdEmpresaId);
        }
      } catch (rbErr) {
        console.error("Falha durante rollback:", rbErr);
      }
      throw stepErr;
    }
  } catch (err: any) {
    console.error("Onboarding error:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
