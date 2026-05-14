import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  cliente_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Sem auth" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    const PORTAL_URL =
      Deno.env.get("PORTAL_URL") ?? "https://ditt-portal-loki.lovable.app";

    if (!RESEND_KEY) {
      return json({ success: false, error: "RESEND_API_KEY não configurada" }, 500);
    }

    const supabaseUser = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabaseUser.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ success: false, error: "Auth inválida" }, 401);

    const { cliente_id }: Payload = await req.json();
    if (!cliente_id) return json({ success: false, error: "cliente_id obrigatório" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: cliente, error: errCli } = await supabase
      .from("clientes")
      .select("id, nome, email, empresa_id, convite_token, convite_expira_em, status_convite, tipo_cliente")
      .eq("id", cliente_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (errCli || !cliente) {
      return json({ success: false, error: "Cliente não encontrado" }, 404);
    }

    const { data: perfil } = await supabase
      .from("user_profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!perfil || perfil.empresa_id !== cliente.empresa_id) {
      return json({ success: false, error: "Sem permissão pra esse cliente" }, 403);
    }

    if (cliente.status_convite !== "pendente" || !cliente.convite_token) {
      return json({ success: false, error: "Convite não está pendente" }, 400);
    }
    if (!cliente.email) {
      return json({ success: false, error: "Cliente sem email" }, 400);
    }

    const link = `${PORTAL_URL}/aceitar-convite/${cliente.convite_token}`;
    const expira = new Date(cliente.convite_expira_em).toLocaleDateString("pt-BR");

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Ditt Software <convites@ditt.com.br>",
        to: [cliente.email],
        subject: "Seu acesso ao portal Ditt",
        html: htmlEmail({ nome: cliente.nome, link, expira }),
        reply_to: "contato@ditt.com.br",
      }),
    });

    if (!resp.ok) {
      const erroResend = await resp.text();
      console.error("Resend error:", resp.status, erroResend);
      return json({ success: false, error: `Resend: ${resp.status} ${erroResend}` }, 502);
    }

    await supabase
      .from("clientes")
      .update({ convite_email_enviado_em: new Date().toISOString() })
      .eq("id", cliente_id);

    return json({ success: true, email: cliente.email });
  } catch (e) {
    console.error("enviar-convite-email error:", e);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

function htmlEmail(args: { nome: string; link: string; expira: string }) {
  const verde = "#00C896";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Seu acesso ao portal Ditt</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding:32px 40px 8px;">
              <div style="display:inline-block;background:${verde};color:#ffffff;font-weight:800;font-size:14px;letter-spacing:0.5px;padding:6px 12px;border-radius:8px;">DITT</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 8px;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#0a0a0a;line-height:1.3;">Olá, ${escape(args.nome)}!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 24px;">
              <p style="margin:0;font-size:15px;color:#3f3f46;line-height:1.6;">
                Você foi convidado a acessar o <strong>Portal Ditt</strong> — sua área pra acompanhar ordens de serviço, ver saldo da conta-corrente e aprovar orçamentos direto pelo celular.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 40px 24px;">
              <a href="${args.link}"
                 style="display:inline-block;background:${verde};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">
                Criar minha conta
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 24px;">
              <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
                Esse link é válido até <strong>${args.expira}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                Se o botão não funcionar, copie e cole no navegador:<br/>
                <span style="color:#52525b;word-break:break-all;">${args.link}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 32px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.5;">
                Se você não esperava esse convite, pode ignorar — nada acontece.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
