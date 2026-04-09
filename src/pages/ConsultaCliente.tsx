import { useState } from "react";
import { Search, Wrench, Smartphone, Clock, DollarSign, FileText, ChevronRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["status_ordem"];

const statusLabels: Record<Status, string> = {
  recebido: "Recebido", em_analise: "Em Análise", aguardando_aprovacao: "Aguardando Aprovação",
  em_reparo: "Em Reparo", pronto: "Pronto para Retirada", entregue: "Entregue",
};

const statusDescriptions: Record<Status, string> = {
  recebido: "Seu aparelho foi recebido e está na fila de atendimento.",
  em_analise: "Nosso técnico está analisando o problema do seu aparelho.",
  aguardando_aprovacao: "O orçamento foi enviado. Aguardamos sua aprovação para iniciar o reparo.",
  em_reparo: "Seu aparelho está sendo reparado pelo nosso técnico.",
  pronto: "O reparo foi concluído! Seu aparelho está pronto para retirada.",
  entregue: "Aparelho já foi entregue. Obrigado pela confiança!",
};

const statusColors: Record<Status, { dot: string; bg: string; text: string }> = {
  recebido: { dot: "bg-muted-foreground", bg: "bg-muted", text: "text-muted-foreground" },
  em_analise: { dot: "bg-info", bg: "bg-info-muted", text: "text-info" },
  aguardando_aprovacao: { dot: "bg-warning", bg: "bg-warning-muted", text: "text-warning" },
  em_reparo: { dot: "bg-info", bg: "bg-info-muted", text: "text-info" },
  pronto: { dot: "bg-success", bg: "bg-success-muted", text: "text-success" },
  entregue: { dot: "bg-foreground/30", bg: "bg-muted", text: "text-muted-foreground" },
};

// The 6-step flow for the progress bar
const steps: Status[] = ["recebido", "em_analise", "aguardando_aprovacao", "em_reparo", "pronto", "entregue"];
const stepLabels = ["Recebido", "Análise", "Orçamento", "Reparo", "Pronto", "Entregue"];

type OrderResult = {
  numero: number;
  status: Status;
  defeito_relatado: string;
  valor: number | null;
  previsao_entrega: string | null;
  data_entrada: string;
  observacoes: string | null;
  aparelhos: {
    marca: string;
    modelo: string;
    clientes: { nome: string } | null;
  } | null;
  historico: { status_novo: string; created_at: string }[];
};

export default function ConsultaCliente() {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = search.replace(/\D/g, "");
    if (!num) return;

    setLoading(true);
    setNotFound(false);
    setOrder(null);

    const { data, error } = await supabase
      .from("ordens_de_servico")
      .select(`numero, status, defeito_relatado, valor, previsao_entrega, data_entrada, observacoes, aparelhos ( marca, modelo, clientes ( nome ) )`)
      .eq("numero", parseInt(num))
      .maybeSingle();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    // Fetch history
    const { data: hist } = await supabase
      .from("historico_ordens")
      .select("status_novo, created_at")
      .eq("ordem_id", (data as any).id ?? "")
      .order("created_at", { ascending: true });

    // We need the id for history - let's refetch with id
    const { data: fullData } = await supabase
      .from("ordens_de_servico")
      .select(`id, numero, status, defeito_relatado, valor, previsao_entrega, data_entrada, observacoes, aparelhos ( marca, modelo, clientes ( nome ) )`)
      .eq("numero", parseInt(num))
      .single();

    let historico: { status_novo: string; created_at: string }[] = [];
    if (fullData) {
      const { data: h } = await supabase
        .from("historico_ordens")
        .select("status_novo, created_at")
        .eq("ordem_id", fullData.id)
        .order("created_at", { ascending: true });
      historico = h ?? [];
    }

    setOrder({
      ...(fullData ?? data) as any,
      historico,
    });
    setLoading(false);
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : null;

  const currentStepIdx = order ? steps.indexOf(order.status) : -1;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-2.5">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary">
            <Wrench className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">CellFix</p>
            <p className="text-[10px] text-muted-foreground">Acompanhe seu aparelho</p>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6 md:py-10">
        {!order ? (
          /* ── Search screen ── */
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-xl font-semibold tracking-tight">Consultar Ordem de Serviço</h1>
              <p className="text-sm text-muted-foreground">Digite o número da sua OS para acompanhar o andamento</p>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ex: 001"
                  className="pl-9 h-11 text-base"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  inputMode="numeric"
                  autoFocus
                />
              </div>
              <Button type="submit" className="h-11 px-5" disabled={loading || !search.trim()}>
                {loading ? <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : "Buscar"}
              </Button>
            </form>

            {notFound && (
              <div className="text-center py-8 space-y-2">
                <p className="text-sm font-medium">Ordem não encontrada</p>
                <p className="text-xs text-muted-foreground">Verifique o número e tente novamente</p>
              </div>
            )}

            <div className="rounded-xl border bg-card p-5 space-y-3">
              <p className="text-xs font-medium">Como encontrar o número da OS?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O número da ordem de serviço está no comprovante que você recebeu quando deixou o aparelho. 
                Caso não tenha o comprovante, entre em contato conosco.
              </p>
            </div>
          </div>
        ) : (
          /* ── Result screen ── */
          <div className="space-y-5">
            <button
              onClick={() => { setOrder(null); setSearch(""); }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Nova consulta
            </button>

            {/* OS header */}
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Ordem de Serviço</p>
                  <p className="text-2xl font-bold tracking-tight">#{String(order.numero).padStart(3, "0")}</p>
                </div>
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
                  statusColors[order.status].bg,
                  statusColors[order.status].text,
                )}>
                  <span className={cn("h-2 w-2 rounded-full", statusColors[order.status].dot)} />
                  {statusLabels[order.status]}
                </span>
              </div>
              <p className="text-sm">{statusDescriptions[order.status]}</p>
            </div>

            {/* Progress steps */}
            <div className="rounded-xl border bg-card p-5">
              <p className="text-xs font-medium text-muted-foreground mb-4">Progresso</p>
              <div className="flex items-center justify-between">
                {steps.map((step, i) => {
                  const done = i <= currentStepIdx;
                  const isCurrent = i === currentStepIdx;
                  return (
                    <div key={step} className="flex flex-col items-center flex-1">
                      <div className="flex items-center w-full">
                        {i > 0 && (
                          <div className={cn("h-0.5 flex-1", done ? "bg-success" : "bg-border")} />
                        )}
                        <div className={cn(
                          "h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold",
                          isCurrent ? "bg-success text-success-foreground ring-2 ring-success/30" :
                          done ? "bg-success text-success-foreground" :
                          "bg-border text-muted-foreground"
                        )}>
                          {done ? "✓" : i + 1}
                        </div>
                        {i < steps.length - 1 && (
                          <div className={cn("h-0.5 flex-1", i < currentStepIdx ? "bg-success" : "bg-border")} />
                        )}
                      </div>
                      <span className={cn(
                        "text-[9px] mt-1.5 text-center leading-tight",
                        isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                      )}>
                        {stepLabels[i]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Details */}
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <DetailRow icon={Smartphone} label="Aparelho" value={`${order.aparelhos?.marca} ${order.aparelhos?.modelo}`} />
              <DetailRow icon={FileText} label="Problema" value={order.defeito_relatado} />
              {order.valor ? (
                <DetailRow icon={DollarSign} label="Valor" value={`R$ ${Number(order.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
              ) : null}
              <DetailRow icon={Clock} label="Entrada" value={fmtDate(order.data_entrada) ?? "—"} />
              {order.previsao_entrega && (
                <DetailRow icon={Clock} label="Previsão" value={fmtDate(order.previsao_entrega) ?? "—"} highlight />
              )}
            </div>

            {/* Observações */}
            {order.observacoes && (
              <div className="rounded-xl border bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground mb-2">Observações</p>
                <p className="text-sm">{order.observacoes}</p>
              </div>
            )}

            {/* Histórico */}
            {order.historico.length > 0 && (
              <div className="rounded-xl border bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground mb-3">Histórico</p>
                <div className="space-y-0">
                  {order.historico.map((h, i) => (
                    <div key={i} className="flex gap-3 py-2">
                      <div className="flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full bg-border mt-1" />
                        {i < order.historico.length - 1 && <div className="flex-1 w-px bg-border" />}
                      </div>
                      <div className="pb-1">
                        <p className="text-sm font-medium">{statusLabels[h.status_novo as Status] ?? h.status_novo}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(h.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={cn("text-sm font-medium", highlight && "text-success")}>{value}</p>
      </div>
    </div>
  );
}
