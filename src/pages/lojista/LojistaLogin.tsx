import { useState } from "react";
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
  const { toast } = useToast();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/lojista`,
        },
      });
      if (error) {
        const msg = error.message || "";
        if (msg.includes("only request this after")) {
          const match = msg.match(/after (\d+) seconds?/);
          const segundos = match ? match[1] : "alguns";
          toast({
            title: "Aguarde um momento",
            description: `Por segurança, aguarde ${segundos} segundos antes de solicitar um novo código.`,
            variant: "destructive",
          });
        } else if (msg.includes("rate limit") || msg.includes("too many")) {
          toast({
            title: "Muitas tentativas",
            description: "Aguarde alguns minutos antes de tentar novamente.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro ao enviar código",
            description: "Verifique o email e tente novamente.",
            variant: "destructive",
          });
        }
        return;
      }
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
        email,
        token: otp,
        type: "email",
      });
      if (error) throw error;

      const userId = authData.user?.id;
      if (!userId) throw new Error("Erro ao identificar usuário");

      // Vincular registro pendente se existir
      const { data: pendente } = await supabase
        .from("lojista_usuarios")
        .select("id")
        .eq("email", email)
        .eq("ativo", false)
        .maybeSingle();

      if (pendente) {
        await supabase
          .from("lojista_usuarios")
          .update({ user_id: userId, ativo: true })
          .eq("id", pendente.id);
      }

      // Verificar acesso
      const { data: lojistaUser } = await supabase
        .from("lojista_usuarios")
        .select("id")
        .eq("user_id", userId)
        .eq("ativo", true)
        .maybeSingle();

      if (!lojistaUser) {
        await supabase.auth.signOut();
        toast({
          title: "Acesso não autorizado",
          description: "Este email não tem acesso ao portal lojista.",
          variant: "destructive",
        });
        setStep("email");
        setOtp("");
        return;
      }

      window.location.replace("/lojista");
    } catch (err: any) {
      toast({
        title: "Código inválido",
        description: "O código está incorreto ou expirou. Tente novamente.",
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
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? (
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
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
