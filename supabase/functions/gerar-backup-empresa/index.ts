import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { getCorsHeaders } from "../_shared/cors.ts";

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(bin);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let historicoId: string | null = null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const tipo: string = body.tipo || "manual";
    const enviarEmail: boolean = body.enviar_email ?? true;
    const empresaIdOverride: string | undefined = body.empresa_id;
    const isInternal = !!body.internal && req.headers.get("x-internal-secret") === serviceRoleKey;

    let empresaId: string;
    let userId: string | null = null;

    if (isInternal && empresaIdOverride) {
      empresaId = empresaIdOverride;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Não autenticado");
      const supabaseUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      userId = user.id;
      const { data: profile } = await supabaseAdmin
        .from("user_profiles").select("empresa_id").eq("user_id", user.id).maybeSingle();
      if (!profile?.empresa_id) throw new Error("Sem empresa");
      empresaId = profile.empresa_id;
    }

    const { data: config } = await supabaseAdmin
      .from("empresa_config").select("*").eq("empresa_id", empresaId).maybeSingle();
    const { data: empresa } = await supabaseAdmin
      .from("empresas").select("nome").eq("id", empresaId).maybeSingle();

    const emailDestino = config?.backup_email_destino || config?.email;
    if (enviarEmail && !emailDestino) {
      throw new Error("Configure o email de destino antes de enviar backup por email");
    }

    const { data: hist } = await supabaseAdmin
      .from("backup_historico")
      .insert({
        empresa_id: empresaId,
        iniciado_por_user_id: userId,
        tipo,
        status: "processando",
        email_destino: enviarEmail ? emailDestino : null,
      })
      .select()
      .single();
    historicoId = hist?.id ?? null;

    const dadosColetados = await coletarDadosDireto(supabaseAdmin, empresaId);


    // XLSX
    const wb = XLSX.utils.book_new();
    const tabelasIncluidas: string[] = [];
    const contagem: Record<string, number> = {};

    const resumoLinhas: any[][] = [
      ["📦 BACKUP COMPLETO", ""],
      ["Empresa", empresa?.nome || "Sem nome"],
      ["Gerado em", new Date().toLocaleString("pt-BR")],
      ["Tipo", tipo],
      ["", ""],
      ["Tabela", "Registros"],
    ];

    for (const [tabela, arr] of Object.entries(dadosColetados)) {
      if (tabela.startsWith("_")) continue;
      const lista = Array.isArray(arr) ? arr : [];
      contagem[tabela] = lista.length;
      tabelasIncluidas.push(tabela);
      resumoLinhas.push([tabela, String(lista.length)]);
    }

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumoLinhas), "_RESUMO");
    for (const [tabela, arr] of Object.entries(dadosColetados)) {
      if (tabela.startsWith("_")) continue;
      const lista = Array.isArray(arr) ? arr : [];
      if (lista.length === 0) continue;
      const sheet = XLSX.utils.json_to_sheet(lista);
      XLSX.utils.book_append_sheet(wb, sheet, tabela.substring(0, 31));
    }

    const xlsxBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const xlsxBase64 = bufToBase64(xlsxBuffer);
    const jsonStr = JSON.stringify({ ...dadosColetados, _meta: {
      gerado_em: new Date().toISOString(),
      gerado_por_user_id: userId,
      empresa_id: empresaId,
      versao_backup: "1.0",
      contagem,
    } }, null, 2);
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const jsonBase64 = bufToBase64(jsonBytes.buffer);

    const dataStr = new Date().toISOString().split("T")[0];
    const safeName = (empresa?.nome || "empresa").replace(/[^a-zA-Z0-9]/g, "_");
    const nomeXlsx = `backup_${safeName}_${dataStr}.xlsx`;
    const nomeJson = `backup_${safeName}_${dataStr}.json`;

    let emailEnviado = false;
    if (enviarEmail && emailDestino) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) throw new Error("RESEND_API_KEY não configurado");

      const totalRegistros = Object.values(contagem).reduce((s, n) => s + n, 0);
      const tabelaLinhas = Object.entries(contagem)
        .map(([k, v]) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${k}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">${v}</td></tr>`)
        .join("");

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#00C896;margin:0 0 8px">📦 Backup completo de dados</h2>
          <p style="color:#666;margin:0 0 16px"><strong>${empresa?.nome ?? "Empresa"}</strong> — ${new Date().toLocaleString("pt-BR")}</p>
          <p style="margin:0 0 16px">Total de registros: <strong>${totalRegistros}</strong> em ${tabelasIncluidas.length} tabelas</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
            <thead><tr><th style="text-align:left;padding:6px 12px;background:#f5f5f5">Tabela</th><th style="text-align:right;padding:6px 12px;background:#f5f5f5">Registros</th></tr></thead>
            <tbody>${tabelaLinhas}</tbody>
          </table>
          <div style="background:#FFF8E1;border-left:4px solid #FFC107;padding:12px;margin:16px 0;font-size:13px;color:#555">
            <strong>Anexos:</strong><br>
            • <code>${nomeXlsx}</code> — abra no Excel ou Google Sheets<br>
            • <code>${nomeJson}</code> — use para restaurar dados via Configurações → Backup
          </div>
          <p style="font-size:12px;color:#999;margin-top:24px">Guarde este email em um lugar seguro. Em caso de falha no sistema, use o arquivo JSON pra restaurar.</p>
        </div>`;

      const fromAddress = Deno.env.get("BACKUP_FROM") || "Ditt Backup <backup@ditt.com.br>";
      const emailResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [emailDestino],
          subject: `📦 Backup ${empresa?.nome ?? "Empresa"} — ${dataStr}`,
          html,
          attachments: [
            { filename: nomeXlsx, content: xlsxBase64 },
            { filename: nomeJson, content: jsonBase64 },
          ],
        }),
      });
      if (!emailResp.ok) {
        const err = await emailResp.text();
        throw new Error(`Falha no envio do email: ${err}`);
      }
      emailEnviado = true;
    }

    if (historicoId) {
      await supabaseAdmin.from("backup_historico").update({
        status: "sucesso",
        arquivo_xlsx_bytes: xlsxBuffer.byteLength,
        arquivo_json_bytes: jsonBytes.byteLength,
        tabelas_incluidas: tabelasIncluidas,
        contagem_registros: contagem,
        concluido_em: new Date().toISOString(),
      }).eq("id", historicoId);
    }

    if (emailEnviado) {
      await supabaseAdmin.from("empresa_config")
        .update({ backup_ultimo_envio_em: new Date().toISOString() })
        .eq("empresa_id", empresaId);
    }

    return new Response(JSON.stringify({
      sucesso: true,
      historico_id: historicoId,
      tabelas: tabelasIncluidas.length,
      registros_total: Object.values(contagem).reduce((s, n) => s + n, 0),
      email_enviado: emailEnviado,
      xlsx_base64: enviarEmail ? null : xlsxBase64,
      json_base64: enviarEmail ? null : jsonBase64,
      nome_xlsx: nomeXlsx,
      nome_json: nomeJson,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[gerar-backup]", e);
    if (historicoId) {
      await supabaseAdmin.from("backup_historico").update({
        status: "erro",
        erro_mensagem: e instanceof Error ? e.message : "desconhecido",
        concluido_em: new Date().toISOString(),
      }).eq("id", historicoId);
    }
    return new Response(JSON.stringify({
      sucesso: false,
      erro: e instanceof Error ? e.message : "desconhecido",
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function coletarDadosDireto(admin: any, empresaId: string): Promise<Record<string, any>> {
  const resultado: Record<string, any> = {};

  const simples: Array<[string, boolean]> = [
    ["empresa_config", false],
    ["socios", true],
    ["socio_metas", false],
    ["funcionarios", true],
    ["clientes", true],
    ["lojista_grupos", true],
    ["fornecedores", true],
    ["tipos_servico", true],
    ["aparelhos", true],
    ["ordens_de_servico", true],
    ["os_servicos", false],
    ["comissoes", false],
    ["contas_a_pagar", true],
    ["movimentacoes_financeiras", false],
    ["ajustes_mensais", false],
    ["prejuizos", true],
    ["garantias", false],
    ["etiqueta_templates", true],
    ["modelos_documento", false],
  ];

  for (const [tabela, comDeletedAt] of simples) {
    try {
      let q = admin.from(tabela).select("*").eq("empresa_id", empresaId);
      if (comDeletedAt) q = q.is("deleted_at", null);
      const { data, error } = await q;
      if (error) {
        console.warn(`[backup] ${tabela}: ${error.message}`);
        resultado[tabela] = [];
      } else {
        resultado[tabela] = data || [];
      }
    } catch (e) {
      console.warn(`[backup] ${tabela} exception:`, e);
      resultado[tabela] = [];
    }
  }

  // Tabelas dependentes (sem empresa_id direto)
  try {
    const ids = (resultado.funcionarios || []).map((f: any) => f.id);
    if (ids.length) {
      const { data } = await admin.from("funcionario_movimentacoes").select("*").in("funcionario_id", ids);
      resultado.funcionario_movimentacoes = data || [];
    } else {
      resultado.funcionario_movimentacoes = [];
    }
  } catch {
    resultado.funcionario_movimentacoes = [];
  }

  try {
    const ids = (resultado.ordens_de_servico || []).map((o: any) => o.id);
    if (ids.length) {
      const { data } = await admin.from("os_pecas").select("*").in("ordem_id", ids);
      resultado.os_pecas = data || [];
    } else {
      resultado.os_pecas = [];
    }
  } catch {
    resultado.os_pecas = [];
  }

  return resultado;
}
