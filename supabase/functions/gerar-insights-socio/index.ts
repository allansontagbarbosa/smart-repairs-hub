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
    const userId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Cache
    const { data: cache } = await admin
      .from("socio_insights_cache")
      .select("insights_json, gerado_em")
      .eq("user_id", userId)
      .gt("expira_em", new Date().toISOString())
      .order("gerado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cache) {
      return new Response(JSON.stringify({
        sucesso: true,
        cached: true,
        gerado_em: cache.gerado_em,
        insights: cache.insights_json,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) Dados do painel — usa client autenticado pra respeitar auth.uid()
    const { data: painel, error: painelErr } = await userClient.rpc("get_painel_socio_v1");
    if (painelErr || !painel?.sucesso) {
      return new Response(JSON.stringify({ error: "Sem dados de painel", details: painelErr?.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prof } = await admin
      .from("user_profiles").select("empresa_id").eq("user_id", userId).maybeSingle();

    // 3) Prompt
    const sys = `Você é um consultor financeiro experiente para uma assistência técnica de celulares.
Vai receber dados financeiros reais da empresa e deve gerar EXATAMENTE 3 insights acionáveis.
Cada insight deve:
- Ser específico (não genérico tipo "reduza custos")
- Ter um número/valor concreto (R$, %, dias)
- Ter uma ação clara que o sócio pode tomar
- Ser BRUTALMENTE HONESTO (apontar funcionários improdutivos, fornecedores caros, etc)
- Ser em português brasileiro coloquial

Retorne APENAS JSON válido neste formato exato (sem markdown, sem texto fora):
{
  "insights": [
    {
      "tipo": "risco|oportunidade|alerta",
      "titulo": "frase curta de até 50 caracteres",
      "descricao": "explicação de 2-3 frases com números concretos",
      "valor_impacto_centavos": numero_inteiro_positivo_em_centavos,
      "acao_sugerida": "frase curta com ação imperativa"
    }
  ]
}`;

    const userMsg = `Dados do painel do sócio:
- Nome: ${painel.socio.nome}
- Participação: ${painel.socio.percentual}%
- Dia ${painel.periodo.dias_passados} de ${painel.periodo.dias_no_mes}

MÊS ATUAL (parcial):
- Faturamento: R$ ${painel.mes_atual.faturamento}
- Receita de serviços: R$ ${painel.mes_atual.receita_servicos ?? (painel.mes_atual.faturamento - painel.mes_atual.custo_pecas)}
- Custo de peças: R$ ${painel.mes_atual.custo_pecas}
- Despesas pagas: R$ ${painel.mes_atual.despesas}
- Comissões pagas: R$ ${painel.mes_atual.comissoes}
- Lucro líquido: R$ ${painel.mes_atual.lucro_liquido}
- Valor parcial dele: R$ ${painel.mes_atual.meu_valor_parcial}
- Fechamento previsto dele: R$ ${painel.mes_atual.fechamento_previsto}

MÊS PASSADO:
- Lucro líquido: R$ ${painel.mes_passado.lucro_liquido}
- Valor dele: R$ ${painel.mes_passado.meu_valor}

VARIAÇÃO: ${painel.variacao_mes}%

FUNCIONÁRIOS CLT (técnicos):
${JSON.stringify(painel.funcionarios_roi, null, 2)}

SAÚDE FINANCEIRA:
- Inadimplência: R$ ${(painel.saude.inadimplencia_centavos / 100).toFixed(2)} (${painel.saude.inadimplencia_qtd ?? 0} contas, máx ${painel.saude.inadimplencia_dias_max ?? 0} dias)
- Gastos fixos médios: R$ ${(painel.saude.gastos_fixos_mes_centavos / 100).toFixed(2)}

Gere 3 insights agora.`;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: sys,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("Claude error:", errText);
      return new Response(JSON.stringify({ error: "Erro Claude API", details: errText }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const claudeData = await claudeRes.json();
    const textOut = claudeData.content?.[0]?.text || "";
    const clean = textOut.replace(/```json\n?|```/g, "").trim();
    let insights;
    try {
      insights = JSON.parse(clean);
    } catch {
      console.error("Falha parse Claude:", clean);
      return new Response(JSON.stringify({ error: "Resposta IA inválida" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("socio_insights_cache").insert({
      empresa_id: prof?.empresa_id,
      user_id: userId,
      insights_json: insights,
      tokens_input: claudeData.usage?.input_tokens,
      tokens_output: claudeData.usage?.output_tokens,
    });

    return new Response(JSON.stringify({
      sucesso: true,
      cached: false,
      gerado_em: new Date().toISOString(),
      insights,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("gerar-insights-socio:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
