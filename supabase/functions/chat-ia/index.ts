import { getCorsHeaders } from "../_shared/cors.ts";
// supabase/functions/chat-ia/index.ts
// Edge Function do assistente IA do Ditt — Anthropic Claude com tool use.
// Cada tool é uma RPC SECURITY DEFINER que valida empresa_id internamente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODELO_PADRAO = "claude-haiku-4-5";
const MAX_TOOL_ITERATIONS = 6;

const TOOLS = [
  {
    name: "buscar_os",
    description:
      "Busca ordens de serviço por filtros. Use quando o usuário pedir lista de OS por status, cliente, técnico ou período.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "array",
          items: { type: "string" },
          description: "Lista de status (recebido, em_analise, em_reparo, pronto, entregue, cancelado)",
        },
        tecnico_id: { type: "string", description: "UUID do técnico (funcionario_id)" },
        cliente_busca: { type: "string", description: "Busca parcial pelo nome do cliente" },
        data_inicio: { type: "string", description: "ISO timestamp" },
        data_fim: { type: "string", description: "ISO timestamp" },
        limite: { type: "integer", default: 20, maximum: 100 },
      },
    },
  },
  {
    name: "metricas_periodo",
    description:
      "Retorna faturamento, lucro, custos, contagens e ticket médio em um período. Use pra resumos financeiros e operacionais.",
    input_schema: {
      type: "object",
      properties: {
        inicio: { type: "string", description: "ISO timestamp" },
        fim: { type: "string", description: "ISO timestamp" },
      },
      required: ["inicio", "fim"],
    },
  },
  {
    name: "os_em_risco_atraso",
    description: "Lista OS abertas que estão atrasadas ou com prazo nos próximos 3 dias.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "lista_compras_pecas",
    description:
      "Retorna peças que precisam ser repostas, com sugestão de quantidade baseada em consumo dos últimos 90 dias e nível de urgência (critica, alta, media).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "historico_servico",
    description:
      "Estatísticas históricas (preço médio, tempo médio, custo) de serviços por modelo de aparelho e/ou defeito. Use pra sugerir preço ou prever tempo.",
    input_schema: {
      type: "object",
      properties: {
        modelo: { type: "string", description: "Ex: 'iPhone 12'" },
        defeito: { type: "string", description: "Ex: 'tela quebrada'" },
      },
    },
  },
  {
    name: "detalhar_os",
    description: "Retorna detalhe completo de UMA OS específica. Só use quando souber o ID exato.",
    input_schema: {
      type: "object",
      properties: { os_id: { type: "string" } },
      required: ["os_id"],
    },
  },
  {
    name: "comparar_periodos",
    description:
      "Compara métricas de dois períodos. Use pra responder perguntas como 'por que a margem caiu este mês'.",
    input_schema: {
      type: "object",
      properties: {
        p1_inicio: { type: "string" },
        p1_fim: { type: "string" },
        p2_inicio: { type: "string" },
        p2_fim: { type: "string" },
      },
      required: ["p1_inicio", "p1_fim", "p2_inicio", "p2_fim"],
    },
  },
  {
    name: "propor_mudar_status",
    description:
      "Gera uma PROPOSTA de mudança de status pra UMA OS. Não executa nada — usuário aprova via card. Use quando o usuário pedir explicitamente (ex: 'marca a OS 45 como pronta'). Sempre resolva o número da OS pro UUID antes (use buscar_os).",
    input_schema: {
      type: "object",
      properties: {
        os_id: { type: "string", description: "UUID da OS" },
        novo_status: {
          type: "string",
          enum: ["recebido","em_analise","em_reparo","aguardando_aprovacao","aguardando_peca","pronto","entregue","cancelado"],
        },
      },
      required: ["os_id", "novo_status"],
    },
  },
  {
    name: "agregar_aparelhos_periodo",
    description:
      "Conta OS agrupadas por marca + modelo do aparelho. Use pra perguntas tipo 'quantos iPhone 14 foram enviados em abril', 'qual modelo o cliente X mais envia', 'top aparelhos do mês'. Pode filtrar por cliente, período, marca ou modelo.",
    input_schema: {
      type: "object",
      properties: {
        data_inicio: { type: "string", description: "ISO timestamp do início do período" },
        data_fim: { type: "string", description: "ISO timestamp do fim do período" },
        cliente_busca: { type: "string", description: "Busca parcial pelo nome do cliente" },
        marca_busca: { type: "string", description: "Busca parcial pela marca (ex: Apple, Samsung)" },
        modelo_busca: { type: "string", description: "Busca parcial pelo modelo (ex: iPhone 14, S21)" },
        limite: { type: "integer", default: 50, maximum: 100 },
      },
    },
  },
  {
    name: "top_defeitos_periodo",
    description:
      "Retorna os defeitos mais relatados em um período (agrupados por similaridade nas primeiras palavras). Use pra perguntas tipo 'top 10 defeitos do mês', 'quais problemas mais aparecem em iPhone'.",
    input_schema: {
      type: "object",
      properties: {
        data_inicio: { type: "string", description: "ISO timestamp" },
        data_fim: { type: "string", description: "ISO timestamp" },
        marca_busca: { type: "string" },
        modelo_busca: { type: "string" },
        limite: { type: "integer", default: 10, maximum: 50 },
      },
    },
  },
  {
    name: "preview_acao_em_massa",
    description:
      "Gera PREVIEW de ação em massa (NÃO executa). Limite 200 registros. Aprovação requer admin + confirmação textual no frontend. Use quando o usuário pedir mudança em várias OS de uma vez.",
    input_schema: {
      type: "object",
      properties: {
        filtro: {
          type: "object",
          properties: {
            status: { type: "array", items: { type: "string" } },
            entregue_ha_dias_min: { type: "integer" },
            tecnico_id: { type: "string" },
          },
        },
        acao: { type: "string", enum: ["marcar_paga", "atribuir_tecnico", "mudar_status"] },
      },
      required: ["filtro", "acao"],
    },
  },
];

const TOOL_TO_RPC: Record<string, string> = {
  buscar_os: "ia_buscar_os",
  metricas_periodo: "ia_metricas_periodo",
  os_em_risco_atraso: "ia_os_em_risco_atraso",
  lista_compras_pecas: "ia_lista_compras_pecas",
  historico_servico: "ia_historico_servico",
  detalhar_os: "ia_detalhar_os",
  comparar_periodos: "ia_comparar_periodos",
  propor_mudar_status: "ia_validar_proposta_status",
  preview_acao_em_massa: "ia_preview_acao_em_massa",
  agregar_aparelhos_periodo: "ia_agregar_aparelhos_periodo",
  top_defeitos_periodo: "ia_top_defeitos_periodo",
};

function buildSystemPrompt() {
  const agora = new Date().toISOString();
  return `Você é o assistente IA do Ditt Software (gestão de assistência técnica de celulares).

Use as ferramentas disponíveis pra responder com base em dados reais. Nunca invente números.

== FLUXO: DIAGNÓSTICO ASSISTIDO ==
Quando o usuário descrever um defeito (ex: "iPhone 12 com tela preta", "S22 não carrega"):
1. Chame historico_servico(modelo, defeito) pra ver estatísticas de casos similares.
2. Sugira causas prováveis (do mais comum pro menos comum), com base no que já foi feito antes.
3. Sugira peças que costumam ser trocadas nesse cenário.
4. Sugira faixa de preço (mínimo, médio, máximo do histórico).
5. Avise quando há poucos casos no histórico (qtd_amostras < 3) — diga "tenho pouco dado pra esse caso".

== FLUXO: LISTA DE COMPRAS ==
Quando o usuário pedir lista de compras de peças:
1. Chame lista_compras_pecas.
2. Apresente em formato organizado: agrupe por urgência (crítica, alta, média).
3. Para cada peça mostre: nome, estoque atual, sugestão de compra, custo unitário estimado, custo total estimado.
4. No final, mostre o custo total da lista.
5. Ofereça versão pronta pra WhatsApp/texto se o usuário pedir.

== FLUXO: ANÁLISE FINANCEIRA ==
Pra perguntas como "por que faturamento caiu", "como tá o mês":
1. Use comparar_periodos com este mês × mês anterior.
2. Identifique se a queda é em: faturamento bruto, lucro, margem, qtd de OS, ticket médio.
3. Aponte UMA causa principal (não fique listando teorias).

REGRAS GERAIS:
- Português brasileiro, direto.
- Datas ISO. Hoje: ${agora}.
- "Este mês" = primeiro dia do mês até agora.
- Máximo 4 chamadas de ferramenta por mensagem.

== MODIFICAÇÕES (L3 INDIVIDUAL E L4 EM MASSA) ==
Você PODE propor modificações, MAS NUNCA executa direto. Sempre gera proposta e o usuário aprova clicando.

L3 — UMA OS por vez (mudar status, marcar paga, atribuir técnico):
1. Se o usuário deu número da OS, primeiro chame buscar_os pra resolver número→UUID.
2. Chame propor_mudar_status com o UUID e o novo_status.
3. Se a tool retornar valido=false, explique o erro e NÃO emita card.
4. Se valido=true, escreva uma frase curta e ANEXE no final UMA tag JSON exatamente assim (sem markdown):
[PROPOSTA]{"tipo":"individual","os_id":"<uuid>","os_numero":<numero>,"status_atual":"<status>","status_novo":"<novo>"}[/PROPOSTA]

L4 — Ação em massa:
1. Chame preview_acao_em_massa com filtro e acao.
2. Se success=false ou excede_limite=true, avise o usuário pra restringir o filtro.
3. Caso contrário, escreva uma frase curta e ANEXE UMA tag:
[PROPOSTA]{"tipo":"massa","acao":"<acao>","qtd":<n>,"ids":[...],"amostra":[...],"excede_limite":<bool>}[/PROPOSTA]

REGRAS DE PROPOSTA:
- NUNCA emita mais de uma tag [PROPOSTA] na mesma mensagem.
- NUNCA emita [PROPOSTA] sem antes ter chamado a tool de validação/preview correspondente.
- Ações DESTRUTIVAS são proibidas — recuse categoricamente: excluir OS, alterar permissões/perfis, mexer em sócios, empresa_config, comissão base, valores financeiros já lançados. Responda: "Essa operação não é permitida via assistente — faça pelas telas próprias com auditoria."`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);
    if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY não configurada" }, 500);

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
      if (errNova || !nova?.success) return json({ error: "Erro ao criar conversa" }, 500);
      conversaId = nova.conversa_id;
    }

    // 3. Empresa
    const { data: convInfo, error: errConv } = await userClient
      .from("ia_conversas")
      .select("empresa_id")
      .eq("id", conversaId)
      .single();

    if (errConv || !convInfo?.empresa_id) {
      return json({ error: "Conversa sem empresa associada" }, 500);
    }
    const empresaId = convInfo.empresa_id;

    // 4. Histórico
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

    // 6. ID do user para o log
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;

    // 7. Loop de tool use
    const { resposta, tokensIn, tokensOut, iteracoes } = await processarChat({
      userClient,
      adminClient,
      conversaId,
      empresaId,
      userId,
      historico: historico ?? [],
      mensagemUsuario: mensagem,
    });

    // 8. Salvar resposta + atualizar conversa + registrar uso
    await userClient.from("ia_mensagens").insert({
      conversa_id: conversaId,
      empresa_id: empresaId,
      papel: "assistant",
      conteudo: resposta,
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
      resposta,
      tokens: { input: tokensIn, output: tokensOut },
      iteracoes,
    });
  } catch (e) {
    console.error("chat-ia erro:", e);
    return json({ error: String(e) }, 500);
  }
});

interface ProcessarArgs {
  userClient: any;
  adminClient: any;
  conversaId: string;
  empresaId: string;
  userId?: string;
  historico: Array<{ papel: string; conteudo: string }>;
  mensagemUsuario: string;
}

async function processarChat({
  userClient,
  adminClient,
  conversaId,
  empresaId,
  userId,
  historico,
  mensagemUsuario,
}: ProcessarArgs) {
  const messages: any[] = historico.map((m) => ({
    role: m.papel === "assistant" ? "assistant" : "user",
    content: m.conteudo,
  }));
  messages.push({ role: "user", content: mensagemUsuario });

  let totalIn = 0;
  let totalOut = 0;
  let respostaFinal = "";
  let iteracoes = 0;

  while (iteracoes < MAX_TOOL_ITERATIONS) {
    iteracoes++;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO_PADRAO,
        max_tokens: 2048,
        system: buildSystemPrompt(),
        tools: TOOLS,
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic erro:", res.status, errText);
      throw new Error(`Anthropic ${res.status}: ${errText}`);
    }

    const data = await res.json();
    totalIn += data.usage?.input_tokens ?? 0;
    totalOut += data.usage?.output_tokens ?? 0;

    if (data.stop_reason === "tool_use") {
      const assistantContent = data.content;
      messages.push({ role: "assistant", content: assistantContent });

      const toolResults: any[] = [];
      for (const block of assistantContent) {
        if (block.type !== "tool_use") continue;

        const rpcName = TOOL_TO_RPC[block.name];
        if (!rpcName) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ error: "Tool desconhecida" }),
            is_error: true,
          });
          continue;
        }

        // Mapear { foo: 1 } → { p_foo: 1 }
        const params: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(block.input ?? {})) {
          params[`p_${k}`] = v;
        }

        const { data: rpcData, error: rpcError } = await userClient.rpc(rpcName, params);
        const result = rpcError ? { error: rpcError.message } : rpcData;

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
          is_error: !!rpcError,
        });

        // Log de auditoria
        try {
          await adminClient.from("ia_acoes_log").insert({
            empresa_id: empresaId,
            usuario_id: userId,
            conversa_id: conversaId,
            tool_chamada: block.name,
            argumentos: block.input,
            resultado: result,
            status: rpcError ? "erro" : "executada",
            erro_mensagem: rpcError?.message ?? null,
          });
        } catch (logErr) {
          console.error("Falha ao logar ação IA:", logErr);
        }
      }

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // end_turn, stop_sequence, max_tokens, etc. — encerra
    respostaFinal = data.content?.find((b: any) => b.type === "text")?.text ?? "";
    break;
  }

  if (!respostaFinal) {
    respostaFinal =
      "Cheguei no limite de chamadas de ferramentas pra esta pergunta. Tente reformular de forma mais específica.";
  }

  return { resposta: respostaFinal, tokensIn: totalIn, tokensOut: totalOut, iteracoes };
}
