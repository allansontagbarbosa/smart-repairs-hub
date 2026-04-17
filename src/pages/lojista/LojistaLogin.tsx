import { useState, useEffect } from "react";
import { AssistProLogo } from "@/components/AssistProLogo";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, LogIn, Mail, ArrowLeft } from "lucide-react";

export default function LojistaLogin() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { toast } = useToast();

  // Se já estiver logado, redireciona pro portal
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        window.location.replace("/lojista");
      }
    });
  }, []);

  // Countdown do botão de reenvio
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const parseError = (err: any): string => {
    const msg = err?.message || err?.error_description || err?.context?.error || "";
    if (!msg) return "Erro desconhecido. Tente novamente.";
    // Erros de rede
    if (/load failed|failed to fetch|network|networkerror/i.test(msg)) {
      return "Falha de conexão. Verifique sua internet e tente novamente.";
    }
    if (msg.includes("only request this after")) {
      const match = msg.match(/after (\d+) seconds?/);
      const seg = match ? match[1] : "alguns";
      return `Aguarde ${seg} segundos antes de solicitar novo código.`;
    }
    if (/rate limit|too many/i.test(msg)) {
      return "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
    }
    return msg;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || cooldown > 0) return;
    setLoading(true);
    try {
      // Pré-validação por status_acesso na tabela lojistas
      const emailLower = email.trim().toLowerCase();
      const { data: lojistaCheck, error: checkError } = await supabase
        .from("lojistas")
        .select("status_acesso")
        .eq("email", emailLower)
        .is("deleted_at", null)
        .limit(1);

      if (checkError && !/load failed|failed to fetch|network/i.test(checkError.message || "")) {
        console.warn("[portal-lojista] check lojista falhou:", checkError);
      }

      const status = lojistaCheck?.[0]?.status_acesso;
      if (!checkError) {
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
            description: "Seu convite ainda não foi aceito. Verifique seu email ou solicite reenvio à assistência.",
            variant: "destructive",
          });
          return;
        }
        if (status === "inativo") {
          toast({
            title: "Acesso revogado",
            description: "Seu acesso foi revogado. Entre em contato com a assistência.",
            variant: "destructive",
          });
          return;
        }
      }

      // IMPORTANTE: NÃO passar emailRedirectTo. Sem ele, o Supabase
      // envia OTP de 6 dígitos puro (sem magic link) no template.
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
        },
      });
      if (error) {
        toast({
          title: "Erro ao enviar código",
          description: parseError(error),
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Código enviado!",
        description: "Verifique seu email e insira o código de 6 dígitos.",
      });
      setStep("otp");
      setCooldown(60);
    } catch (err: any) {
      console.error("[portal-lojista] send-otp falhou:", err);
      toast({
        title: "Erro ao enviar código",
        description: parseError(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
        },
      });
      if (error) {
        toast({
          title: "Erro ao reenviar",
          description: parseError(error),
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Código reenviado!", description: "Verifique seu email." });
      setCooldown(60);
    } catch (err: any) {
      toast({
        title: "Erro ao reenviar",
        description: parseError(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp,
        type: "email",
      });
      if (error) throw error;

      const userId = authData.user?.id;
      if (!userId) throw new Error("Erro ao identificar usuário");

      const emailLower = email.trim().toLowerCase();

      // 1) Procurar registro já vinculado e ativo
      const { data: ativos } = await supabase
        .from("lojista_usuarios")
        .select("id")
        .eq("user_id", userId)
        .eq("ativo", true)
        .limit(1);

      let temAcesso = (ativos ?? []).length > 0;

      // 2) Se não, tenta backfill: buscar registros pendentes pelo email e vincular
      if (!temAcesso) {
        const { data: pendentes } = await supabase
          .from("lojista_usuarios")
          .select("id")
          .eq("email", emailLower)
          .order("created_at", { ascending: false });

        if ((pendentes ?? []).length > 0) {
          const primeiro = pendentes![0];
          const { error: updErr } = await supabase
            .from("lojista_usuarios")
            .update({ user_id: userId, ativo: true })
            .eq("id", primeiro.id);
          if (!updErr) temAcesso = true;
        }
      }

      if (!temAcesso) {
        await supabase.auth.signOut();
        toast({
          title: "Acesso não autorizado",
          description: "Este email não está cadastrado como lojista parceiro. Fale com a assistência.",
          variant: "destructive",
        });
        setStep("email");
        setOtp("");
        return;
      }

      window.location.replace("/lojista");
    } catch (err: any) {
      console.error("[portal-lojista] verify-otp falhou:", err);
      toast({
        title: "Código inválido",
        description: parseError(err) || "O código está incorreto ou expirou. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
              {step === "email"
                ? "Acesse o painel do parceiro para acompanhar seus aparelhos"
                : `Insira o código de 6 dígitos enviado para ${email}`}
            </p>
          </div>

          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading || cooldown > 0}>
                {loading ? (
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : cooldown > 0 ? (
                  `Aguarde ${cooldown}s para reenviar`
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar código de acesso
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Código de verificação</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-2xl tracking-widest h-14"
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">
                  Verifique sua caixa de entrada e spam
                </p>
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

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={loading || cooldown > 0}
              >
                {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar código"}
              </Button>

              <Button type="button" variant="ghost" className="w-full" onClick={() => { setStep("email"); setOtp(""); }}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Usar outro email
              </Button>
            </form>
          )}
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
