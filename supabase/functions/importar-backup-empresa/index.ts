import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";

const ORDEM_RESTORE = [
  "empresa_config", "socios", "socio_metas", "funcionarios",
  "funcionario_movimentacoes", "fornecedores", "tipos_servico",
  "lojista_grupos", "clientes", "aparelhos",
  "ordens_de_servico", "os_servicos", "os_pecas",
  "comissoes", "contas_a_pagar", "movimentacoes_financeiras",
  "ajustes_mensais", "prejuizos", "garantias",
  "etiqueta_templates", "modelos_documento",
];

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { backup_json, modo = "merge", confirmacao_nome_empresa } = await req.json();
    if (!backup_json) throw new Error("backup_json obrigatório");
    if (!confirmacao_nome_empresa) throw new Error("Digite o nome da empresa pra confirmar");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const { data: profile } = await supabaseAdmin
      .from("user_profiles").select("empresa_id").eq("user_id", user.id).maybeSingle();
    if (!profile?.empresa_id) throw new Error("Sem empresa");

    const { data: empresa } = await supabaseAdmin
      .from("empresas").select("nome").eq("id", profile.empresa_id).maybeSingle();

    if ((empresa?.nome || "").trim().toLowerCase() !== String(confirmacao_nome_empresa).trim().toLowerCase()) {
      throw new Error(`Nome da empresa não confere. Esperado: "${empresa?.nome}"`);
    }

    const empresaBackup = backup_json._meta?.empresa_id;
    if (empresaBackup && empresaBackup !== profile.empresa_id) {
      throw new Error("Esse backup é de outra empresa — não pode importar");
    }

    // Snapshot pré-import
    await supabaseAdmin.from("backup_historico").insert({
      empresa_id: profile.empresa_id,
      iniciado_por_user_id: user.id,
      tipo: "pre_migration",
      status: "sucesso",
      tabelas_incluidas: Object.keys(backup_json).filter(k => !k.startsWith("_")),
      contagem_registros: backup_json._meta?.contagem || {},
    });

    const resultado: Record<string, number> = {};
    for (const tabela of ORDEM_RESTORE) {
      const dados = backup_json[tabela];
      if (!Array.isArray(dados) || dados.length === 0) continue;
      try {
        if (modo === "replace") {
          await supabaseAdmin.from(tabela).delete().eq("empresa_id", profile.empresa_id);
        }
        const { data: inserted, error } = await supabaseAdmin
          .from(tabela)
          .upsert(dados, { onConflict: "id", ignoreDuplicates: false })
          .select("id");
        if (error) throw error;
        resultado[tabela] = inserted?.length || 0;
      } catch (e) {
        console.error(`[restore] ${tabela}:`, e);
        resultado[tabela] = -1;
      }
    }

    return new Response(JSON.stringify({ sucesso: true, modo, registros_restaurados: resultado }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({
      sucesso: false,
      erro: e instanceof Error ? e.message : "desconhecido",
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
