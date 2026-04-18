import { useState } from "react";
import { Link } from "react-router-dom";
import { AssistProLogo } from "@/components/AssistProLogo";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function LojistaRecuperarSenha() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/lojista/redefinir-senha` },
      );
      if (error) {
        toast({
          title: "Erro ao enviar link",
          description: "Tente novamente em instantes.",
          variant: "destructive",
        });
        return;
      }
      setEnviado(true);
      toast({
        title: "Link enviado!",
        description: "Verifique seu email para redefinir sua senha.",
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
          {enviado ? (
            <div className="text-center space-y-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-xl font-semibold">Verifique seu email</h1>
              <p className="text-sm text-muted-foreground">
                Enviamos um link para <strong>{email}</strong>. Abra o email e clique no link para
                criar uma nova senha.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/lojista/login">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao login
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <KeyRound className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-xl font-semibold tracking-tight">Recuperar senha</h1>
                <p className="text-sm text-muted-foreground">
                  Informe seu email para receber um link de redefinição
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                    "Enviar link de recuperação"
                  )}
                </Button>

                <Button asChild variant="ghost" className="w-full">
                  <Link to="/lojista/login">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar ao login
                  </Link>
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
