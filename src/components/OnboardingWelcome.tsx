import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Building2, Users, DollarSign, FileText, ArrowRight, X } from "lucide-react";
import { NovaOrdemDialog } from "@/components/NovaOrdemDialog";

type Step = {
  label: string;
  description: string;
  icon: React.ElementType;
  done: boolean;
  action: () => void;
};

export function OnboardingWelcome() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("onboarding_dismissed") === "true");
  const [novaOrdemOpen, setNovaOrdemOpen] = useState(false);

  const { data: empresa } = useQuery({
    queryKey: ["onboarding-empresa"],
    queryFn: async () => {
      const { data } = await supabase.from("empresa_config").select("nome, gastos_fixos_mensais").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: funcCount = 0 } = useQuery({
    queryKey: ["onboarding-func-count"],
    queryFn: async () => {
      const { count } = await supabase.from("funcionarios").select("id", { count: "exact", head: true }).eq("ativo", true).is("deleted_at", null);
      return count ?? 0;
    },
  });

  const { data: osCount = 0 } = useQuery({
    queryKey: ["onboarding-os-count"],
    queryFn: async () => {
      const { count } = await supabase.from("ordens_de_servico").select("id", { count: "exact", head: true }).is("deleted_at", null);
      return count ?? 0;
    },
  });

  const steps: Step[] = [
    {
      label: "Configure os dados da empresa",
      description: "Nome, endereço, CNPJ e identidade visual",
      icon: Building2,
      done: !!(empresa?.nome && empresa.nome.trim().length > 0 && empresa.nome !== ""),
      action: () => navigate("/configuracoes?tab=geral"),
    },
    {
      label: "Cadastre seus técnicos",
      description: "Adicione pelo menos um funcionário",
      icon: Users,
      done: funcCount > 0,
      action: () => navigate("/configuracoes?tab=tecnicos"),
    },
    {
      label: "Configure gastos fixos",
      description: "Defina seus custos mensais",
      icon: DollarSign,
      done: Number(empresa?.gastos_fixos_mensais ?? 0) > 0,
      action: () => navigate("/configuracoes?tab=financeiro"),
    },
    {
      label: "Crie sua primeira OS",
      description: "Registre uma ordem de serviço",
      icon: FileText,
      done: osCount > 0,
      action: () => setNovaOrdemOpen(true),
    },
  ];

  const allDone = steps.every((s) => s.done);
  const completedCount = steps.filter((s) => s.done).length;

  if (dismissed || allDone) return null;

  const handleDismiss = () => {
    localStorage.setItem("onboarding_dismissed", "true");
    setDismissed(true);
  };

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                👋 Bem-vindo ao AssistPro!
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Vamos configurar seu sistema. Complete os passos abaixo:
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3 mb-5">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <button
                  key={i}
                  onClick={step.action}
                  className="w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 group"
                >
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                  )}
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${step.done ? "line-through text-muted-foreground" : ""}`}>
                      {i + 1}. {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  {!step.done && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {completedCount}/{steps.length} concluídos
            </p>
            <Button size="sm" onClick={steps.find((s) => !s.done)?.action}>
              Começar agora <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <NovaOrdemDialog open={novaOrdemOpen} onOpenChange={setNovaOrdemOpen} onSuccess={() => setNovaOrdemOpen(false)} />
    </>
  );
}
