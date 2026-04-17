import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AssistProLogo } from "@/components/AssistProLogo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Building2, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type State =
  | { kind: "loading" }
  | { kind: "invalid"; reason: string }
  | { kind: "ready"; lojista: { id: string; nome: string; email: string }; empresaNome: string }
  | { kind: "accepting" }
  | { kind: "done" }
  | { kind: "error"; reason: string };

export default function AceitarConviteLojista() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", reason: "Link inválido — token ausente." });
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("accept-lojista-invite", {
          body: { token, action: "validate" },
        });
        if (error || !data?.ok) {
          setState({
            kind: "invalid",
            reason: (data as any)?.error ?? error?.message ?? "Convite inválido ou expirado.",
          });
          return;
        }
        setState({
          kind: "ready",
          lojista: data.lojista,
          empresaNome: data.empresa_nome,
        });
      } catch (e: any) {
        setState({ kind: "invalid", reason: e?.message ?? "Erro ao validar convite." });
      }
    })();
  }, [token]);

  async function aceitar() {
    setState({ kind: "accepting" });
    try {
      const { data, error } = await supabase.functions.invoke("accept-lojista-invite", {
        body: { token, action: "accept" },
      });
      if (error || !data?.ok || !data?.action_link) {
        setState({
          kind: "error",
          reason: (data as any)?.error ?? error?.message ?? "Falha ao aceitar convite.",
        });
        return;
      }
      // Redireciona pro magic link — Supabase processa e leva pro /lojista
      window.location.replace(data.action_link as string);
    } catch (e: any) {
      setState({ kind: "error", reason: e?.message ?? "Erro inesperado." });
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-2.5">
          <AssistProLogo size="sm" />
          <div className="flex items-center gap-1.5 ml-1">
            <p className="text-[10px] text-muted-foreground">Portal Lojista</p>
            <span className="text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
              B2B
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          {state.kind === "loading" && (
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Validando convite…</p>
            </div>
          )}

          {state.kind === "invalid" && (
            <div className="text-center space-y-4">
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <h1 className="text-xl font-semibold">Convite inválido</h1>
              <p className="text-sm text-muted-foreground">{state.reason}</p>
              <p className="text-xs text-muted-foreground">
                Entre em contato com a assistência para receber um novo convite.
              </p>
            </div>
          )}

          {state.kind === "ready" && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-xl font-semibold">Você foi convidado!</h1>
                <p className="text-sm text-muted-foreground">
                  <strong>{state.empresaNome}</strong> convidou você para acessar o Portal Lojista
                  como parceiro comercial.
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Lojista</span>
                  <span className="font-medium text-right">{state.lojista.nome}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Email vinculado</span>
                  <span className="font-medium text-right break-all">{state.lojista.email}</span>
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Ao aceitar, você poderá:</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>Acompanhar aparelhos em reparo</li>
                  <li>Ver orçamentos e histórico</li>
                  <li>Receber notificações sobre serviços</li>
                </ul>
              </div>

              <Button className="w-full h-11" onClick={aceitar}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Aceitar e acessar o portal
              </Button>
            </div>
          )}

          {state.kind === "accepting" && (
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Criando seu acesso…</p>
            </div>
          )}

          {state.kind === "error" && (
            <div className="text-center space-y-4">
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <h1 className="text-xl font-semibold">Erro ao aceitar</h1>
              <p className="text-sm text-muted-foreground">{state.reason}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
