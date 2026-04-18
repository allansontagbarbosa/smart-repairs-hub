import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, CheckCircle2, AlertCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State =
  | { kind: "loading" }
  | { kind: "valid" }
  | { kind: "already" }
  | { kind: "invalid"; message: string }
  | { kind: "submitting" }
  | { kind: "done" };

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", message: "Link inválido. Token ausente." });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } },
        );
        const data = await res.json();
        if (!res.ok) {
          setState({ kind: "invalid", message: data?.error ?? "Link inválido ou expirado." });
          return;
        }
        if (data?.valid === false && data?.reason === "already_unsubscribed") {
          setState({ kind: "already" });
          return;
        }
        setState({ kind: "valid" });
      } catch {
        setState({ kind: "invalid", message: "Não foi possível validar o link." });
      }
    })();
  }, [token]);

  async function confirm() {
    setState({ kind: "submitting" });
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) {
        setState({ kind: "invalid", message: "Não foi possível concluir o cancelamento." });
        return;
      }
      if ((data as any)?.success || (data as any)?.reason === "already_unsubscribed") {
        setState({ kind: "done" });
      } else {
        setState({ kind: "invalid", message: "Não foi possível concluir o cancelamento." });
      }
    } catch {
      setState({ kind: "invalid", message: "Erro inesperado." });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Cancelar inscrição</CardTitle>
          <CardDescription>Gerenciar emails enviados pelo sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.kind === "loading" && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validando link...
            </div>
          )}
          {state.kind === "valid" && (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Confirme o cancelamento para deixar de receber emails deste endereço.
              </p>
              <Button className="w-full" onClick={confirm}>
                Confirmar cancelamento
              </Button>
            </>
          )}
          {state.kind === "submitting" && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
            </div>
          )}
          {state.kind === "done" && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="text-sm">Inscrição cancelada com sucesso.</p>
            </div>
          )}
          {state.kind === "already" && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="text-sm">Este email já foi cancelado anteriormente.</p>
            </div>
          )}
          {state.kind === "invalid" && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
