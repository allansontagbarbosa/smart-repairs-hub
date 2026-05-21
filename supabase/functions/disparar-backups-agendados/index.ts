import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const agora = new Date();
    const horaAtual = agora.getUTCHours();
    const diaSemana = agora.getUTCDay();

    const { data: configs } = await admin
      .from("empresa_config")
      .select("empresa_id, backup_frequencia, backup_dia_semana, backup_hora, backup_ultimo_envio_em, backup_email_destino, email")
      .neq("backup_frequencia", "desativado");

    const disparados: any[] = [];
    for (const cfg of configs || []) {
      if (!cfg.empresa_id) continue;
      if (cfg.backup_hora !== horaAtual) continue;
      if (cfg.backup_frequencia === "semanal" && cfg.backup_dia_semana !== diaSemana) continue;
      if (cfg.backup_frequencia === "mensal" && agora.getUTCDate() !== 1) continue;

      // evitar duplicar se já enviou nas últimas 12h
      if (cfg.backup_ultimo_envio_em) {
        const ultimo = new Date(cfg.backup_ultimo_envio_em).getTime();
        if (agora.getTime() - ultimo < 12 * 3600 * 1000) continue;
      }
      if (!(cfg.backup_email_destino || cfg.email)) continue;

      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/gerar-backup-empresa`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            "x-internal-secret": serviceRoleKey,
          },
          body: JSON.stringify({
            tipo: "automatico",
            enviar_email: true,
            empresa_id: cfg.empresa_id,
            internal: true,
          }),
        });
        disparados.push({ empresa_id: cfg.empresa_id, status: resp.status });
      } catch (e) {
        disparados.push({ empresa_id: cfg.empresa_id, erro: String(e) });
      }
    }

    return new Response(JSON.stringify({ disparados, hora: horaAtual, dia: diaSemana }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
