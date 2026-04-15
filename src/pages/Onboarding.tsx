import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, ArrowRight, ArrowLeft, Check, CheckCircle2, Sparkles } from "lucide-react";
import { AssistProLogo } from "@/components/AssistProLogo";
import { toast } from "sonner";

const PLANS = [
  {
    id: "basico",
    name: "Básico",
    price: "R$ 97",
    period: "/mês",
    trial: "14 dias grátis",
    features: ["Até 2 usuários", "200 OS/mês", "Suporte por email"],
    highlighted: false,
  },
  {
    id: "profissional",
    name: "Profissional",
    price: "R$ 197",
    period: "/mês",
    trial: "14 dias grátis",
    features: ["Usuários ilimitados", "OS ilimitadas", "Fila IA", "Suporte prioritário"],
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Consultar",
    period: "",
    trial: "Personalizado",
    features: ["Multi-unidade", "API", "Gestor dedicado"],
    highlighted: false,
  },
];

export default function Onboarding() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingEmpresa, setCheckingEmpresa] = useState(true);

  // Step 1 data
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  // Step 2 data
  const [plano, setPlano] = useState("profissional");

  useEffect(() => {
    if (authLoading || !user) return;
    supabase
      .from("user_profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.empresa_id) {
          navigate("/dashboard", { replace: true });
        } else {
          setCheckingEmpresa(false);
          setEmail(user.email || "");
        }
      });
  }, [user, authLoading, navigate]);

  if (authLoading || !user || checkingEmpresa) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const handleCreateEmpresa = async () => {
    if (!nomeEmpresa.trim()) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const res = await supabase.functions.invoke("setup-empresa", {
        body: {
          nomeEmpresa: nomeEmpresa.trim(),
          cnpj: cnpj.trim() || null,
          telefone: telefone.trim() || null,
          email: email.trim() || null,
          plano,
        },
      });

      if (res.error) throw new Error(res.error.message || "Erro ao configurar empresa");
      if (res.data?.error) throw new Error(res.data.error);

      setStep(3);
    } catch (err: any) {
      console.error("Erro no onboarding:", err);
      toast.error("Erro ao configurar empresa: " + (err.message || "Tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={`h-2 rounded-full transition-all ${
            s === step ? "w-8 bg-primary" : s < step ? "w-8 bg-primary/40" : "w-8 bg-muted"
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <AssistProLogo size="md" />
        </div>
        {stepIndicator}

        {/* STEP 1 — Company */}
        {step === 1 && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Building2 className="h-5 w-5" /> Sua empresa
              </CardTitle>
              <CardDescription>Preencha os dados básicos da sua assistência técnica.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome-empresa">Nome da empresa *</Label>
                <Input
                  id="nome-empresa"
                  placeholder="Ex: Conserta Tudo Celulares"
                  value={nomeEmpresa}
                  onChange={(e) => setNomeEmpresa(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ (opcional)</Label>
                <Input id="cnpj" placeholder="00.000.000/0001-00" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone *</Label>
                  <Input id="telefone" placeholder="(11) 99999-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-empresa">Email da empresa</Label>
                  <Input id="email-empresa" type="email" placeholder="contato@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <Button className="w-full" onClick={() => setStep(2)} disabled={!nomeEmpresa.trim() || !telefone.trim()}>
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 2 — Plan */}
        {step === 2 && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5" /> Escolher plano
              </CardTitle>
              <CardDescription>Todos os planos incluem 14 dias de teste grátis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {PLANS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlano(p.id)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      plano === p.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{p.name}</span>
                          {p.highlighted && <Badge variant="secondary" className="text-xs">★ Recomendado</Badge>}
                        </div>
                        <div className="mt-1">
                          <span className="text-lg font-bold">{p.price}</span>
                          <span className="text-sm text-muted-foreground">{p.period}</span>
                        </div>
                      </div>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        plano === p.id ? "border-primary bg-primary" : "border-muted-foreground/30"
                      }`}>
                        {plano === p.id && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {p.features.map((f) => (
                        <li key={f} className="text-xs text-muted-foreground flex items-center gap-1">
                          <Check className="h-3 w-3 text-primary" /> {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
                <Button onClick={handleCreateEmpresa} disabled={loading} className="flex-1">
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Configurando...</>
                  ) : (
                    <>Criar empresa <ArrowRight className="h-4 w-4 ml-1" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3 — Success */}
        {step === 3 && (
          <Card>
            <CardContent className="pt-8 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
              <h2 className="text-2xl font-bold">Tudo pronto!</h2>
              <p className="text-muted-foreground">
                Empresa criada com sucesso! Seu período de teste de 14 dias começou.
              </p>
              <Button size="lg" className="w-full" onClick={() => { window.location.href = "/dashboard"; }}>
                Acessar meu painel <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
