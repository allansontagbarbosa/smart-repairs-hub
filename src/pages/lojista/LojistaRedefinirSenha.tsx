import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AssistProLogo } from "@/components/AssistProLogo";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LojistaRedefinirSenha() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pronto, setPronto] = useState(false);

  // Aguarda o Supabase processar o hash de recovery
  useEffect(() => {
    const hash = window.location.hash;
    const hasRecovery = /type=recovery|access_token=/i.test(hash);

    if (!hasRecovery) {
      // Verifica se já há sessão recovery ativa
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setPronto(true);
        else {
          toast({
            title: "Link inválido ou expirado",
            description: "Solicite um novo link de recuperação.",
            variant: "destructive",
          });
          setTimeout(() => navigate("/lojista/recuperar-senha", { replace: true }), 2000);
        }
      });
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        if (window.location.hash) {
          history.replaceState(null, "", window.location.pathname);
        }
        setPronto(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) {
      toast({ title: "Senha muito curta", description: "Mínimo 8 caracteres.", variant: "destructive" });
      return;
    }
    if (senha !== confirmar) {
      toast({ title: "Senhas diferentes", description: "Confirme a mesma senha.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        toast({
          title: "Erro ao redefinir senha",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Senha redefinida!", description: "Você já está conectado." });
      navigate("/lojista", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-2.5">
          <AssistProLogo size="sm" />
          <div className="flex items-center gap-1.5 ml-1">
            <p className="text-[10px] text-muted-foreground">Portal Lojista</p>
            <span className="text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">B2B</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          {!pronto ? (
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Validando link de recuperação…</p>
            </div>
          ) : (
            <>
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <KeyRound className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-xl font-semibold tracking-tight">Nova senha</h1>
                <p className="text-sm text-muted-foreground">
                  Defina uma nova senha para acessar o portal
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="senha">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={showSenha ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmar">Confirmar senha</Label>
                  <Input
                    id="confirmar"
                    type={showSenha ? "text" : "password"}
                    placeholder="Repita a senha"
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>

                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Redefinir senha"
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
