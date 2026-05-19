import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: prof } = await admin
      .from("user_profiles")
      .select("empresa_id")
      .eq("user_id", claims.claims.sub)
      .maybeSingle();

    let latitude = -22.9056, longitude = -47.0608, cidade = "Campinas", estado = "SP";
    if (prof?.empresa_id) {
      const { data: emp } = await admin
        .from("empresas")
        .select("latitude, longitude, cidade, estado")
        .eq("id", prof.empresa_id)
        .maybeSingle();
      if (emp?.latitude) latitude = Number(emp.latitude);
      if (emp?.longitude) longitude = Number(emp.longitude);
      if (emp?.cidade) cidade = emp.cidade;
      if (emp?.estado) estado = emp.estado;
    }

    const hoje = new Date();
    const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);
    const trinta = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fmtBCB = (d: Date) => `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}-${d.getFullYear()}`;

    let dolar: number | null = null, eur: number | null = null, dolar_30d: number | null = null;
    try {
      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@moeda='USD'&@dataInicial='${fmtBCB(trinta)}'&@dataFinalCotacao='${fmtBCB(hoje)}'&$format=json&$select=cotacaoVenda,dataHoraCotacao&$orderby=dataHoraCotacao desc`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.value?.[0]) dolar = Number(j.value[0].cotacaoVenda);
      if (j.value?.length > 20) dolar_30d = Number(j.value[j.value.length - 1].cotacaoVenda);
    } catch (e) { console.error("dolar:", e); }

    try {
      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='EUR'&@dataCotacao='${fmtBCB(ontem)}'&$format=json&$select=cotacaoVenda`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.value?.[0]) eur = Number(j.value[0].cotacaoVenda);
    } catch (e) { console.error("eur:", e); }

    let selic: number | null = null;
    try {
      const r = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json`);
      const j = await r.json();
      if (j[0]) selic = Number(j[0].valor);
    } catch (e) { console.error("selic:", e); }

    let clima: any = null;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,precipitation,weather_code&daily=precipitation_sum,weather_code&timezone=America/Sao_Paulo&forecast_days=7`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.current) {
        clima = {
          cidade, estado,
          temperatura_atual: j.current.temperature_2m,
          precipitacao_atual_mm: j.current.precipitation,
          weather_code_atual: j.current.weather_code,
          dias_chuva_proxima_semana: (j.daily?.precipitation_sum || []).filter((p: number) => p > 1).length,
        };
      }
    } catch (e) { console.error("clima:", e); }

    const feriados2026 = [
      { data: "2026-01-01", nome: "Confraternização Universal" },
      { data: "2026-02-16", nome: "Carnaval (segunda)" },
      { data: "2026-02-17", nome: "Carnaval (terça)" },
      { data: "2026-03-29", nome: "Sexta-feira Santa" },
      { data: "2026-04-21", nome: "Tiradentes" },
      { data: "2026-05-01", nome: "Dia do Trabalho" },
      { data: "2026-05-29", nome: "Corpus Christi" },
      { data: "2026-09-07", nome: "Independência" },
      { data: "2026-10-12", nome: "N. Sra. Aparecida" },
      { data: "2026-11-02", nome: "Finados" },
      { data: "2026-11-15", nome: "Proclamação da República" },
      { data: "2026-12-25", nome: "Natal" },
    ];
    const hojeStr = hoje.toISOString().slice(0, 10);
    const limiteStr = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const proximos = feriados2026.filter(f => f.data >= hojeStr && f.data <= limiteStr);

    return new Response(JSON.stringify({
      sucesso: true,
      atualizado_em: new Date().toISOString(),
      dolar: dolar ? {
        valor: dolar,
        variacao_30d_pct: dolar_30d ? ((dolar - dolar_30d) / dolar_30d * 100) : null,
      } : null,
      eur: eur ? { valor: eur } : null,
      selic: selic ? { valor_anual_pct: selic } : null,
      clima,
      feriados_proximos: proximos.map(f => ({
        ...f,
        dias_ate: Math.floor((new Date(f.data).getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000)),
      })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("get-fatores-externos:", err);
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
