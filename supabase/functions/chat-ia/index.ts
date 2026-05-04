// supabase/functions/chat-ia/index.ts
// Edge Function do assistente IA do Ditt — usa Anthropic Claude direto.
// Validações: auth + teto mensal + rate-limit diário (via RPC ia_pode_usar).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODELO_PADRAO = "claude-haiku-4-5";

const SYSTEM_PROMPT = `Você é o assistente IA do Ditt Software, um sistema de gestão de assistência técnica de celulares.

Você ajuda donos de oficina e técnicos a tomarem decisões mais rápidas com base nos dados do sistema.

Regras de comunicação:
- Responda em português brasileiro, direto e claro.
- Não invente números — se não tiver dado, diga "não tenho essa informação".
- Use formatação leve (negrito, listas) só quando agregar.
- Quando o usuário perguntar sobre OS, peças, finanças ou qualquer dado do sistema, EM BREVE você terá ferramentas pra consultar. Por enquanto, se a pergunta for factual sobre os dados, diga "estou em fase de aprendizado, ainda não consulto dados ao vivo — em breve essa funcionalidade chega".
- Para dúvidas gerais sobre como usar o Ditt, responda normalmente.

Você está numa fase inicial. Foco agora é conversar bem e construir confiança.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autenticado" }, 401);
    }

    if (!ANTHROPIC_API_KEY) {
      return json({ error: "ANTHROPIC_API_KEY não configurada no servidor" }, 500);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const { conversa_id, mensagem } = body ?? {};

    if (!mensagem || typeof mensagem !== "string" || mensagem.trim().length === 0) {
      return json({ error: "Mensagem inválida" }, 400);
    }
    if (mensagem.length > 4000) {
      return json({ error: "Mensagem muito longa (máx 4000 caracteres)" }, 400);
    }

    // 1. Pode usar?
    const { data: podeUsar, error: errPode } = await userClient.rpc("ia_pode_usar");
    if (errPode) return json({ error: errPode.message }, 500);
    if (!podeUsar?.pode) {
      return json(
        {
          error: "limite_atingido",
          motivo: podeUsar?.motivo,
          custo_brl: podeUsar?.custo_brl,
          teto_brl: podeUsar?.teto_brl,
        },
        429,
      );
    }

    // 2. Garantir conversa
    let conversaId = conversa_id;
    if (!conversaId) {
      const { data: nova, error: errNova } = await userClient.rpc("ia_criar_conversa", {
        p_titulo: mensagem.substring(0, 80),
        p_contexto: null,
      });
      if (errNova || !nova?.success) {
        return json({ error: "Erro ao criar conversa" }, 500);
      }
      conversaId = nova.conversa_id;
    }

    // 3. Empresa da conversa
    const { data: convInfo, error: errConv } = await userClient
      .from("ia_conversas")
      .select("empresa_id")
      .eq("id", conversaId)
      .single();

    if (errConv || !convInfo?.empresa_id) {
      return json({ error: "Conversa sem empresa associada" }, 500);
    }
    const empresaId = convInfo.empresa_id;

    // 4. Histórico (últimas 20)
    const { data: historico } = await userClient
      .from("ia_mensagens")
      .select("papel, conteudo")
      .eq("conversa_id", conversaId)
      .in("papel", ["user", "assistant"])
      .order("criado_em", { ascending: true })
      .limit(20);

    // 5. Inserir mensagem do usuário
    await userClient.from("ia_mensagens").insert({
      conversa_id: conversaId,
      empresa_id: empresaId,
      papel: "user",
      conteudo: mensagem,
    });

    // 6. Montar mensagens
    const messages = (historico ?? []).map((m: any) => ({
      role: m.papel === "assistant" ? "assistant" : "user",
      content: m.conteudo,
    }));
    messages.push({ role: "user", content: mensagem });

    // 7. Anthropic
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO_PADRAO,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic erro:", anthropicRes.status, errText);
      return json({ error: "Erro na API do assistente" }, 502);
    }

    const data = await anthropicRes.json();
    const respostaTexto = data.content?.[0]?.text ?? "(sem resposta)";
    const tokensIn = data.usage?.input_tokens ?? 0;
    const tokensOut = data.usage?.output_tokens ?? 0;

    // 8. Salvar resposta + atualizar conversa
    await userClient.from("ia_mensagens").insert({
      conversa_id: conversaId,
      empresa_id: empresaId,
      papel: "assistant",
      conteudo: respostaTexto,
      tokens_input: tokensIn,
      tokens_output: tokensOut,
      modelo: MODELO_PADRAO,
    });

    await userClient
      .from("ia_conversas")
      .update({ atualizado_em: new Date().toISOString() })
      .eq("id", conversaId);

    await adminClient.rpc("ia_registrar_uso", {
      p_empresa_id: empresaId,
      p_tokens_input: tokensIn,
      p_tokens_output: tokensOut,
      p_modelo: MODELO_PADRAO,
    });

    return json({
      success: true,
      conversa_id: conversaId,
      resposta: respostaTexto,
      tokens: { input: tokensIn, output: tokensOut },
    });
  } catch (e) {
    console.error("chat-ia erro:", e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
