import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, UserCheck, Loader2, Eye, EyeOff, AlertCircle, ArrowLeft, Mail } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const DEMO_EMAIL = "demo@smartrepairs.com";
const DEMO_PASSWORD = "Demo@123";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  // Fetch company name
  const { data: empresa } = useQuery({
    queryKey: ["empresa-login"],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresa_config")
        .select("nome")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const verifyInternalUser = async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", userId)
      .eq("ativo", true)
      .maybeSingle();
    return !!data;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setLoading(false);
      setError("Email ou senha incorretos. Tente novamente.");
      return;
    }

    const isInternal = await verifyInternalUser(data.user.id);
    if (!isInternal) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Usuário não autorizado. Entre em contato com o administrador.");
      return;
    }

    setLoading(false);
    navigate("/", { replace: true });
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (authError) {
      setDemoLoading(false);
      setError("Conta demo não configurada. Contate o administrador.");
      return;
    }

    if (data?.user) {
      await supabase.rpc("ensure_demo_user" as any, {
        p_user_id: data.user.id,
        p_email: DEMO_EMAIL,
      });
    }

    setDemoLoading(false);
    navigate("/", { replace: true });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setError("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/login`,
    });

    setResetLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetSent(true);
  };

  const companyName = empresa?.nome || "Smart Repairs";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Wrench className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">{companyName}</CardTitle>
          <CardDescription>
            {forgotMode
              ? "Informe seu email para recuperar a senha"
              : "Entre com suas credenciais para acessar o sistema"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {forgotMode ? (
            <>
              {resetSent ? (
                <div className="text-center space-y-3 py-4">
                  <Mail className="h-10 w-10 text-primary mx-auto" />
                  <p className="text-sm text-foreground font-medium">Verifique seu email para redefinir a senha.</p>
                  <Button variant="ghost" size="sm" onClick={() => { setForgotMode(false); setResetSent(false); setResetEmail(""); }}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={resetLoading}>
                    {resetLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                    ) : "Enviar link de recuperação"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => { setForgotMode(false); setError(""); }}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao login
                  </Button>
                </form>
              )}
            </>
          ) : (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading || demoLoading}>
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Entrando...</>
                  ) : "Entrar"}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => { setForgotMode(true); setError(""); setResetEmail(email); }}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Esqueci minha senha
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><Separator /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={handleDemo} disabled={loading || demoLoading}>
                {demoLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Entrando...</>
                ) : (
                  <><UserCheck className="mr-2 h-4 w-4" /> Entrar como Demo</>
                )}
              </Button>

              <div className="text-center pt-2">
                <Link to="/portal/login" className="text-xs text-primary hover:text-primary/80 transition-colors">
                  Cliente? Acompanhe sua OS →
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
