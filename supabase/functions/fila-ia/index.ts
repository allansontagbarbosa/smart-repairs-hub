import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { os_pendentes, tecnicos, historico_tempos, estoque } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um gestor de assistência técnica de celulares. Analise os dados abaixo e distribua as ordens de serviço entre os técnicos de forma otimizada.

Regras:
1. Prioridade crítica (prazo vencido ou +5 dias parado) deve ser atribuída primeiro
2. Considere o histórico: calcule o tempo médio de cada técnico por tipo de defeito
3. Verifique se as peças necessárias estão em estoque antes de alocar
4. Distribua a carga de forma equilibrada entre os técnicos disponíveis
5. Se um técnico tem histórico melhor em iPhones, prefira alocar iPhones para ele
6. Retorne APENAS o JSON conforme o schema da tool, sem texto adicional`;

    const userPrompt = `OS pendentes: ${JSON.stringify(os_pendentes)}
Técnicos: ${JSON.stringify(tecnicos)}
Histórico de tempos: ${JSON.stringify(historico_tempos)}
Estoque disponível: ${JSON.stringify(estoque)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "distribuir_fila",
              description: "Retorna a distribuição otimizada das OS entre os técnicos",
              parameters: {
                type: "object",
                properties: {
                  distribuicao: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        os_id: { type: "string" },
                        os_numero: { type: "number" },
                        cliente: { type: "string" },
                        aparelho: { type: "string" },
                        defeitos: { type: "array", items: { type: "string" } },
                        prioridade: { type: "string", enum: ["critica", "atencao", "normal"] },
                        tecnico_sugerido_id: { type: "string" },
                        tecnico_sugerido_nome: { type: "string" },
                        motivo: { type: "string" },
                        tempo_estimado_minutos: { type: "number" },
                        pecas_disponiveis: { type: "boolean" },
                        ordem_execucao: { type: "number" },
                      },
                      required: ["os_id", "os_numero", "cliente", "aparelho", "defeitos", "prioridade", "tecnico_sugerido_id", "tecnico_sugerido_nome", "motivo", "tempo_estimado_minutos", "pecas_disponiveis", "ordem_execucao"],
                      additionalProperties: false,
                    },
                  },
                  alertas: { type: "array", items: { type: "string" } },
                  resumo: { type: "string" },
                },
                required: ["distribuicao", "alertas", "resumo"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "distribuir_fila" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in response:", JSON.stringify(aiResult));
      return new Response(JSON.stringify({ error: "IA não retornou resultado estruturado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultado = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fila-ia error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
