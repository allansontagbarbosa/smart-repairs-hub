import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AssistProLogo } from "@/components/AssistProLogo";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, LogIn, Loader2, Eye, EyeOff } from "lucide-react";

export default function LojistaLogin() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Se já autenticado e for lojista válido, redireciona pro portal.
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const userId = session.user.id;
      const userEmail = (session.user.email || "").toLowerCase();

      const { data: porUserId } = await supabase
        .from("lojista_usuarios")
        .select("id")
        .eq("user_id", userId)
        .eq("ativo", true)
        .limit(1);

      if ((porUserId ?? []).length > 0) {
        navigate("/lojista", { replace: true });
        return;
      }

      if (userEmail) {
        const { data: porEmail } = await supabase
          .from("lojista_usuarios")
          .select("id")
          .eq("email", userEmail)
          .order("created_at", { ascending: false })
          .limit(1);

        if ((porEmail ?? []).length > 0) {
          await supabase
            .from("lojista_usuarios")
            .update({ user_id: userId, ativo: true })
            .eq("id", porEmail[0].id);
          navigate("/lojista", { replace: true });
          return;
        }
      }

      // Sessão de outro perfil — encerra
      await supabase.auth.signOut();
    })();
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) return;
    setLoading(true);

    try {
      const emailLower = email.trim().toLowerCase();

      // 1) Pré-validação via RPC SECURITY DEFINER (não depende de RLS/sessão)
      const { data: verificacao, error: verifError } = await supabase.rpc(
        "verificar_lojista_por_email",
        { email_input: emailLower }
      );

      if (verifError) {
        console.error("[lojista-login] verificacao erro:", verifError);
        toast({
          title: "Erro ao verificar cadastro",
          description: "Tente novamente em instantes.",
          variant: "destructive",
        });
        return;
      }

      const info = (verificacao ?? [])[0];
      const status = info?.existe ? info.status : "nao_convidado";

      if (!status || status === "nao_convidado") {
        toast({
          title: "Email não cadastrado",
          description: "Este email não está cadastrado como lojista parceiro. Fale com a assistência.",
          variant: "destructive",
        });
        return;
      }
      if (status === "convidado") {
        toast({
          title: "Convite pendente",
          description: "Aceite seu convite primeiro pelo link enviado por email.",
          variant: "destructive",
        });
        return;
      }
      if (status === "inativo") {
        toast({
          title: "Acesso revogado",
          description: "Seu acesso foi revogado. Contate a assistência.",
          variant: "destructive",
        });
        return;
      }

      // 2) Login com senha
      const { error } = await supabase.auth.signInWithPassword({
        email: emailLower,
        password: senha,
      });

      if (error) {
        toast({
          title: "Email ou senha inválidos",
          description: "Verifique suas credenciais e tente novamente.",
          variant: "destructive",
        });
        return;
      }

      // Aguardar PostgREST propagar a sessão antes de o guard ler lojista_usuarios
      await new Promise((r) => setTimeout(r, 300));
      navigate("/lojista", { replace: true });
    } catch (err: any) {
      console.error("[lojista-login] erro:", err);
      toast({
        title: "Erro ao entrar",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
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
          <div className="text-center space-y-2">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Portal Lojista</h1>
            <p className="text-sm text-muted-foreground">
              Acesse o painel do parceiro com seu email e senha
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={showSenha ? "text" : "password"}
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="current-password"
                  required
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

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? (
                <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>

            <div className="text-center">
              <Link
                to="/lojista/recuperar-senha"
                className="text-xs text-primary hover:underline"
              >
                Esqueci a senha
              </Link>
            </div>
          </form>
        </div>
      </div>

      <footer className="border-t bg-card py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Este é o portal exclusivo para lojistas parceiros.
        </p>
        <p className="text-xs text-muted-foreground">
          Funcionários acessam por{" "}
          <a href="/login" className="text-primary hover:underline font-medium">/login</a>
        </p>
      </footer>
    </div>
  );
}
