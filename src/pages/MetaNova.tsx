import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useCriarMeta, METRICAS_LABEL, MetricaMeta, EscopoMeta } from "@/hooks/useMetas";
import { toast } from "sonner";

export interface FormState {
  metrica: MetricaMeta | null;
  escopo: EscopoMeta | null;
  escopo_id: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  nome: string;
  valor_alvo: string;
  threshold_atencao: number;
  threshold_alerta: number;
}

export default function MetaNova() {
  const navigate = useNavigate();
  const criar = useCriarMeta();
  const [step, setStep] = useState(1);
  const hoje = new Date();
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const [form, setForm] = useState<FormState>({
    metrica: null,
    escopo: null,
    escopo_id: null,
    periodo_inicio: hoje.toISOString().slice(0, 10),
    periodo_fim: fim.toISOString().slice(0, 10),
    nome: "",
    valor_alvo: "",
    threshold_atencao: 50,
    threshold_alerta: 80,
  });

  const { data: tecnicos = [] } = useQuery({
    queryKey: ["tecnicos-meta"],
    enabled: form.escopo === "tecnico",
    queryFn: async () =>
      (await supabase.from("funcionarios").select("id,nome").eq("ativo", true).is("deleted_at", null).order("nome")).data ?? [],
  });
  const { data: lojas = [] } = useQuery({
    queryKey: ["lojas-meta"],
    enabled: form.escopo === "loja",
    queryFn: async () =>
      (await supabase.from("lojas").select("id,nome").eq("ativo", true).order("nome")).data ?? [],
  });

  const ok =
    (step === 1 && !!form.metrica) ||
    (step === 2 && !!form.escopo && (form.escopo === "empresa" || !!form.escopo_id)) ||
    (step === 3 && !!form.periodo_inicio && !!form.periodo_fim && form.periodo_inicio <= form.periodo_fim) ||
    (step === 4 && !!form.nome.trim() && !!form.valor_alvo && Number(form.valor_alvo) > 0);

  const submit = async () => {
    if (!form.metrica || !form.escopo) return;
    try {
      await criar.mutateAsync({
        nome: form.nome.trim(),
        metrica: form.metrica,
        sentido: METRICAS_LABEL[form.metrica].sentido,
        periodo_inicio: form.periodo_inicio,
        periodo_fim: form.periodo_fim,
        escopo: form.escopo,
        escopo_id: form.escopo === "empresa" ? null : form.escopo_id,
        valor_alvo: Number(form.valor_alvo),
        threshold_atencao: form.threshold_atencao,
        threshold_alerta: form.threshold_alerta,
      });
      toast.success("Meta criada!");
      navigate("/metas");
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar");
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <div>
            <h1 className="text-xl font-semibold">Nova meta</h1>
            <p className="text-xs text-muted-foreground">Passo {step} de 4</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigate("/metas")}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <StepBar step={step} />

      {step === 1 && <StepMetrica form={form} setForm={setForm} />}
      {step === 2 && <StepEscopo form={form} setForm={setForm} tecnicos={tecnicos} lojas={lojas} />}
      {step === 3 && <StepPeriodo form={form} setForm={setForm} />}
      {step === 4 && <StepAlvo form={form} setForm={setForm} />}

      <div className="flex items-center justify-between gap-2 pt-4 border-t border-border">
        <Button variant="outline" onClick={() => (step === 1 ? navigate("/metas") : setStep(step - 1))}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {step === 1 ? "Cancelar" : "Voltar"}
        </Button>
        <Button disabled={!ok || criar.isPending} onClick={() => (step < 4 ? setStep(step + 1) : submit())}>
          {step < 4 ? (
            <>
              Avançar <ArrowRight className="h-4 w-4 ml-1" />
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-1" /> Criar meta
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4].map(s => {
        const ativo = s <= step;
        return (
          <div key={s} className="flex items-center flex-1">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium ${
                ativo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? <Check className="h-3.5 w-3.5" /> : s}
            </div>
            {s < 4 && <div className={`h-0.5 flex-1 mx-1 ${s < step ? "bg-primary" : "bg-muted"}`} />}
          </div>
        );
      })}
    </div>
  );
}

interface StepProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  tecnicos?: { id: string; nome: string }[];
  lojas?: { id: string; nome: string }[];
}

function StepMetrica(_: StepProps) {
  return <p className="text-sm text-muted-foreground">PROMPT 9.</p>;
}
function StepEscopo(_: StepProps) {
  return <p className="text-sm text-muted-foreground">PROMPT 9.</p>;
}
function StepPeriodo(_: StepProps) {
  return <p className="text-sm text-muted-foreground">PROMPT 10.</p>;
}
function StepAlvo(_: StepProps) {
  return <p className="text-sm text-muted-foreground">PROMPT 10.</p>;
}
