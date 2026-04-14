import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, Loader2, Eye, EyeOff, AlertCircle, ArrowLeft, Mail, UserPlus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { MobileFixLogo } from "@/components/MobileFixLogo";

const DEMO_EMAIL = "demo@smartrepairs.com";
const DEMO_PASSWORD = "Demo@123";

type Mode = "login" | "signup" | "forgot";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      setLoading(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: nome },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    setLoading(false);

    if (signUpError) {
      if (signUpError.message.includes("already registered")) {
        setError("Este email já está cadastrado. Tente fazer login.");
      } else {
        setError(signUpError.message);
      }
      return;
    }

    setSignupSuccess(true);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");

    const { error: googleError } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/login`,
    });

    if (googleError) {
      setGoogleLoading(false);
      setError("Erro ao conectar com Google. Tente novamente.");
    }
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (authError) {
      setDemoLoading(false);
      setError("Conta demo não configurada. Contate o administrador.");
      return;
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

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setError("");
    setSignupSuccess(false);
    setResetSent(false);
    if (newMode === "forgot") setResetEmail(email);
  };

  const companyName = empresa?.nome || "MobileFix";
  const anyLoading = loading || demoLoading || googleLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto">
            <MobileFixLogo size="md" showTagline />
          </div>
          <CardDescription>
            {mode === "forgot"
              ? "Informe seu email para recuperar a senha"
              : mode === "signup"
              ? "Crie sua conta para acessar o sistema"
              : "Entre com suas credenciais para acessar o sistema"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── FORGOT PASSWORD ── */}
          {mode === "forgot" && (
            <>
              {resetSent ? (
                <div className="text-center space-y-3 py-4">
                  <Mail className="h-10 w-10 text-primary mx-auto" />
                  <p className="text-sm text-foreground font-medium">Verifique seu email para redefinir a senha.</p>
                  <Button variant="ghost" size="sm" onClick={() => switchMode("login")}>
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
                  <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => switchMode("login")}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao login
                  </Button>
                </form>
              )}
            </>
          )}

          {/* ── SIGNUP SUCCESS ── */}
          {mode === "signup" && signupSuccess && (
            <div className="text-center space-y-3 py-4">
              <Mail className="h-10 w-10 text-primary mx-auto" />
              <p className="text-sm text-foreground font-medium">
                Cadastro realizado! Verifique seu email para confirmar a conta.
              </p>
              <p className="text-xs text-muted-foreground">
                Após confirmar, um administrador precisará ativar seu acesso ao sistema.
              </p>
              <Button variant="ghost" size="sm" onClick={() => switchMode("login")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao login
              </Button>
            </div>
          )}

          {/* ── SIGNUP FORM ── */}
          {mode === "signup" && !signupSuccess && (
            <>
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    type="text"
                    placeholder="Seu nome"
                    value={nome}
                    onChange={(e) => { setNome(e.target.value); setError(""); }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
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
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar senha</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                    required
                    className="pr-10"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={anyLoading}>
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cadastrando...</>
                  ) : (
                    <><UserPlus className="h-4 w-4 mr-2" /> Criar conta</>
                  )}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><Separator /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={anyLoading}>
                {googleLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Conectando...</>
                ) : (
                  <><svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Cadastrar com Google</>
                )}
              </Button>

              <button
                type="button"
                onClick={() => switchMode("login")}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Já tem conta? <span className="text-primary font-medium">Faça login</span>
              </button>
            </>
          )}

          {/* ── LOGIN FORM ── */}
          {mode === "login" && (
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

                <Button type="submit" className="w-full" disabled={anyLoading}>
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Entrando...</>
                  ) : "Entrar"}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => switchMode("forgot")}
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

              <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={anyLoading}>
                {googleLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Conectando...</>
                ) : (
                  <><svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Entrar com Google</>
                )}
              </Button>

              <Button variant="outline" className="w-full" onClick={handleDemo} disabled={anyLoading}>
                {demoLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Entrando...</>
                ) : (
                  <><UserCheck className="mr-2 h-4 w-4" /> Entrar como Demo</>
                )}
              </Button>

              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Não tem conta? <span className="text-primary font-medium">Cadastre-se</span>
              </button>

              <div className="text-center">
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
