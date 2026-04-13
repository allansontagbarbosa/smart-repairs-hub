import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Wrench, UserCheck } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const DEMO_EMAIL = "teste@smartrepairs.com";
const DEMO_PASSWORD = "Teste@123";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast({
        title: "Erro ao entrar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/", { replace: true });
    }
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    // Try to sign in first
    let { error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    // If user doesn't exist, create it then sign in
    if (error) {
      const { error: signUpError } = await supabase.auth.signUp({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        options: { data: { full_name: "Usuário Demo" } },
      });

      if (signUpError) {
        setDemoLoading(false);
        toast({
          title: "Erro ao criar conta demo",
          description: signUpError.message,
          variant: "destructive",
        });
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });

      if (loginError) {
        setDemoLoading(false);
        toast({
          title: "Erro ao entrar como demo",
          description: loginError.message,
          variant: "destructive",
        });
        return;
      }
    }

    setDemoLoading(false);
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Wrench className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Smart Repairs</CardTitle>
          <CardDescription>Entre com suas credenciais para acessar o sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
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
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || demoLoading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleDemo}
            disabled={loading || demoLoading}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            {demoLoading ? "Entrando..." : "Entrar como Demo"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
