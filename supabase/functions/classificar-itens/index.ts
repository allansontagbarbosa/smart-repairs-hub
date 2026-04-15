import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texto } = await req.json();

    if (!texto || typeof texto !== "string") {
      return new Response(JSON.stringify({ error: "Texto é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const truncated = texto.slice(0, 30000);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você recebe o conteúdo de um relatório de produtos/serviços de uma assistência técnica de celulares.
Analise cada item e classifique como "servico" ou "peca".
- Itens que começam com verbos de ação (TROCA, REPARO, RECUPERAÇÃO, SUBSTITUIÇÃO, INSTALAÇÃO, LIMPEZA, MANUTENÇÃO, CALIBRAÇÃO, DESBLOQUEIO, ATUALIZAÇÃO, FORMATAÇÃO, SOLDAGEM, REBALLING) são "servico"
- Demais itens são "peca"
- Tente extrair o preço de cada item se disponível
- Se houver código/SKU, inclua no campo "codigo"
Retorne SOMENTE um JSON válido, sem markdown, sem backticks, no formato:
{
  "items": [
    { "nome": "NOME DO ITEM", "preco": 99.90, "tipo": "servico", "codigo": "123" }
  ]
}
Se não conseguir extrair preço, use null. Se não houver código, use null.`;

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: truncated },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      return new Response(JSON.stringify({ error: "Erro ao processar com IA" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Try to parse the JSON from the response
    let parsed;
    try {
      // Remove possible markdown wrapping
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "A IA retornou um formato inesperado. Tente novamente.", raw: content }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
