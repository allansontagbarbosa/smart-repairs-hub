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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find warranties expiring in exactly 7 days
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 7);
    const dateStr = targetDate.toISOString().split("T")[0];

    const { data: garantias, error } = await supabase
      .from("garantias")
      .select("*, ordens_de_servico ( numero, aparelhos ( clientes ( nome ) ) )")
      .eq("status", "ativa")
      .eq("data_fim", dateStr);

    if (error) throw error;

    let notificacoesCount = 0;
    for (const g of garantias || []) {
      const os = g.ordens_de_servico as any;
      const clienteNome = os?.aparelhos?.clientes?.nome || "Cliente";
      const osNumero = os?.numero || "?";

      await supabase.from("notificacoes").insert({
        tipo: "garantia_vencendo",
        titulo: `Garantia da OS #${String(osNumero).padStart(3, "0")} vence em 7 dias`,
        mensagem: `A garantia de ${clienteNome} (OS #${String(osNumero).padStart(3, "0")}) vence em ${new Date(dateStr).toLocaleDateString("pt-BR")}`,
        referencia_id: g.ordem_id,
        referencia_tabela: "ordens_de_servico",
      });
      notificacoesCount++;
    }

    // Also update expired warranties
    await supabase
      .from("garantias")
      .update({ status: "vencida" })
      .eq("status", "ativa")
      .lt("data_fim", new Date().toISOString().split("T")[0]);

    return new Response(
      JSON.stringify({ success: true, notificacoes_criadas: notificacoesCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
