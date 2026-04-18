import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AssistProLogo } from "@/components/AssistProLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from "lucide-react";

type State =
  | { kind: "loading" }
  | { kind: "invalid"; reason: string }
  | { kind: "ready"; lojista: { id: string; nome: string; email: string }; empresaNome: string }
  | { kind: "accepting" };

function calcularForcaSenha(s: string): { label: string; color: string; level: number } {
  let score = 0;
  if (s.length >= 8) score++;
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) score++;
  if (/\d/.test(s)) score++;
  if (/[^A-Za-z0-9]/.test(s)) score++;
  if (score <= 1) return { label: "Fraca", color: "bg-destructive", level: 1 };
  if (score === 2) return { label: "Média", color: "bg-yellow-500", level: 2 };
  if (score === 3) return { label: "Boa", color: "bg-blue-500", level: 3 };
  return { label: "Forte", color: "bg-green-500", level: 4 };
}

export default function AceitarConviteLojista() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { toast } = useToast();
  const [state, setState] = useState<State>({ kind: "loading" });

  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showSenha, setShowSenha] = useState(false);

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
        if (error) {
          setState({
            kind: "invalid",
            reason: "Não foi possível validar o convite. Tente novamente em instantes.",
          });
          return;
        }
        if (!data?.ok) {
          setState({ kind: "invalid", reason: data?.message ?? "Convite inválido ou expirado." });
          return;
        }
        setState({
          kind: "ready",
          lojista: data.lojista,
          empresaNome: data.empresa_nome,
        });
      } catch (e) {
        console.error("[aceitar-convite] unexpected:", e);
        setState({
          kind: "invalid",
          reason: "Erro inesperado ao validar convite. Atualize a página.",
        });
      }
    })();
  }, [token]);

  async function handleAceitarComSenha(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind !== "ready") return;
    if (senha.length < 8) {
      toast({ title: "Senha muito curta", description: "Mínimo 8 caracteres.", variant: "destructive" });
      return;
    }
    if (senha !== confirmar) {
      toast({ title: "Senhas diferentes", description: "Confirme a mesma senha.", variant: "destructive" });
      return;
    }

    setState({ kind: "accepting" });

    try {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }

      const { data, error } = await supabase.functions.invoke(
        "accept-lojista-invite-with-password",
        { body: { token, senha } },
      );

      if (error || !data?.ok) {
        toast({
          title: "Erro ao aceitar convite",
          description: data?.message ?? "Tente novamente em instantes.",
          variant: "destructive",
        });
        setState({ kind: "ready", lojista: (state as any).lojista, empresaNome: (state as any).empresaNome });
        return;
      }

      if (data.session?.access_token && data.session?.refresh_token) {
        const { error: setErr } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (setErr) {
          console.error("[aceitar-convite] setSession error:", setErr);
        }
        toast({ title: "Bem-vindo ao portal!" });
        navigate("/lojista", { replace: true });
        return;
      }

      // Sem sessão — manda para login
      toast({
        title: "Acesso criado!",
        description: "Faça login com seu email e nova senha.",
      });
      navigate("/lojista/login", { replace: true });
    } catch (e: any) {
      console.error("[aceitar-convite] aceite com senha falhou:", e);
      toast({
        title: "Erro inesperado",
        description: "Atualize a página ou contate a assistência.",
        variant: "destructive",
      });
      setState((prev) =>
        prev.kind === "accepting"
          ? { kind: "ready", lojista: (state as any).lojista, empresaNome: (state as any).empresaNome }
          : prev,
      );
    }
  }

  const forca = senha ? calcularForcaSenha(senha) : null;

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

          {(state.kind === "ready" || state.kind === "accepting") && (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-xl font-semibold">Você foi convidado!</h1>
                <p className="text-sm text-muted-foreground">
                  <strong>{(state as any).empresaNome}</strong> convidou você para acessar o Portal
                  Lojista como parceiro comercial.
                </p>
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Lojista</span>
                  <span className="font-medium text-right">{(state as any).lojista.nome}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Email vinculado</span>
                  <span className="font-medium text-right break-all">
                    {(state as any).lojista.email}
                  </span>
                </div>
              </div>

              <form onSubmit={handleAceitarComSenha} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="senha">Defina sua senha de acesso</Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={showSenha ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      disabled={state.kind === "accepting"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {forca && (
                    <div className="space-y-1">
                      <div className="flex gap-1 h-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-full ${
                              i <= forca.level ? forca.color : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">Força: {forca.label}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmar">Confirmar senha</Label>
                  <Input
                    id="confirmar"
                    type={showSenha ? "text" : "password"}
                    placeholder="Repita a senha"
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    disabled={state.kind === "accepting"}
                  />
                  {confirmar && senha !== confirmar && (
                    <p className="text-xs text-destructive">As senhas não coincidem</p>
                  )}
                </div>

                <Button type="submit" className="w-full h-11" disabled={state.kind === "accepting"}>
                  {state.kind === "accepting" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Aceitar e criar meu acesso
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
