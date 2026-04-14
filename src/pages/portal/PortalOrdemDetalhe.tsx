import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Smartphone, Wrench, Clock, DollarSign,
  Store, User, FileText, CheckCircle2, LogOut,
  Check, X, Loader2, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalCliente, usePortalOrdens, usePortalHistorico } from "@/hooks/usePortalData";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { abrirWhatsApp } from "@/lib/whatsapp";

import { statusLabelsCliente as statusLabels } from "@/lib/status";

const statusColors: Record<string, { dot: string; bg: string; text: string }> = {
  recebido: { dot: "bg-muted-foreground", bg: "bg-muted", text: "text-muted-foreground" },
  em_analise: { dot: "bg-info", bg: "bg-info-muted", text: "text-info" },
  aguardando_aprovacao: { dot: "bg-warning", bg: "bg-warning-muted", text: "text-warning" },
  aprovado: { dot: "bg-success", bg: "bg-success-muted", text: "text-success" },
  em_reparo: { dot: "bg-info", bg: "bg-info-muted", text: "text-info" },
  aguardando_peca: { dot: "bg-warning", bg: "bg-warning-muted", text: "text-warning" },
  pronto: { dot: "bg-success", bg: "bg-success-muted", text: "text-success" },
  entregue: { dot: "bg-foreground/30", bg: "bg-muted", text: "text-muted-foreground" },
};

const steps = ["recebido", "em_analise", "aguardando_aprovacao", "aprovado", "em_reparo", "aguardando_peca", "pronto", "entregue"];
const stepLabels = ["Recebido", "Análise", "Orçamento", "Aprovado", "Reparo", "Peça", "Pronto", "Entregue"];

function fmt(v: number | null | undefined) {
  return `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "—";
}

export default function PortalOrdemDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const { data: cliente } = usePortalCliente();
  const { data: ordens = [] } = usePortalOrdens(cliente?.id);
  const { data: historico = [], isLoading: loadingHist } = usePortalHistorico(id);

  const [approvalState, setApprovalState] = useState<"idle" | "confirming_approve" | "confirming_reject" | "approved" | "rejected" | "saving">("idle");
  const [rejectReason, setRejectReason] = useState("");

  const ordem = ordens.find((o) => o.id === id);

  if (!ordem) {
    return (
      <div className="min-h-screen bg-background">
        <Header onBack={() => navigate("/portal")} user={user} onSignOut={signOut} />
        <div className="flex items-center justify-center py-20">
          <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const currentStepIdx = steps.indexOf(ordem.status);
  const valorPendente = ordem.valor_pendente ?? ((ordem.valor ?? 0) - (ordem.valor_pago ?? 0));
  const isAguardandoAprovacao = ordem.status === "aguardando_aprovacao";
  const aparelhoNome = ordem.aparelhos ? `${ordem.aparelhos.marca} ${ordem.aparelhos.modelo}` : "Aparelho";

  const handleApprove = async () => {
    setApprovalState("saving");
    try {
      const { error: e1 } = await supabase
        .from("ordens_de_servico")
        .update({
          status: "aprovado" as any,
          aprovacao_orcamento: "aprovado",
          data_aprovacao: new Date().toISOString(),
        })
        .eq("id", ordem.id);
      if (e1) throw e1;

      await supabase.from("historico_ordens").insert({
        ordem_id: ordem.id,
        status_anterior: "aguardando_aprovacao",
        status_novo: "aprovado",
        descricao: "Orçamento aprovado pelo cliente via portal",
      });

      // Try to send WhatsApp notification
      try {
        const { data: template } = await supabase
          .from("templates_mensagem")
          .select("mensagem")
          .eq("evento", "orcamento_aprovado")
          .eq("ativo", true)
          .maybeSingle();

        if (template) {
          const { data: empresaConfig } = await supabase
            .from("empresa_config")
            .select("telefone")
            .limit(1)
            .maybeSingle();

          if (empresaConfig?.telefone) {
            const msg = template.mensagem
              .replace("{cliente}", cliente?.nome ?? "Cliente")
              .replace("{valor}", fmt(ordem.valor))
              .replace("{numero}", String(ordem.numero).padStart(3, "0"))
              .replace("{aparelho}", aparelhoNome);
            abrirWhatsApp(empresaConfig.telefone, msg);
          }
        }
      } catch {}

      queryClient.invalidateQueries({ queryKey: ["portal-ordens"] });
      queryClient.invalidateQueries({ queryKey: ["portal-historico"] });
      setApprovalState("approved");
      toast.success("Orçamento aprovado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aprovar orçamento");
      setApprovalState("idle");
    }
  };

  const handleReject = async () => {
    setApprovalState("saving");
    try {
      const { error: e1 } = await supabase
        .from("ordens_de_servico")
        .update({
          status: "recebido" as any,
          aprovacao_orcamento: "recusado",
          motivo_reprovacao: rejectReason || null,
        })
        .eq("id", ordem.id);
      if (e1) throw e1;

      await supabase.from("historico_ordens").insert({
        ordem_id: ordem.id,
        status_anterior: "aguardando_aprovacao",
        status_novo: "recebido",
        descricao: "Orçamento recusado pelo cliente via portal",
        observacao: rejectReason || null,
      });

      // Try to send WhatsApp notification
      try {
        const { data: template } = await supabase
          .from("templates_mensagem")
          .select("mensagem")
          .eq("evento", "orcamento_recusado")
          .eq("ativo", true)
          .maybeSingle();

        if (template) {
          const { data: empresaConfig } = await supabase
            .from("empresa_config")
            .select("telefone")
            .limit(1)
            .maybeSingle();

          if (empresaConfig?.telefone) {
            const msg = template.mensagem
              .replace("{cliente}", cliente?.nome ?? "Cliente")
              .replace("{numero}", String(ordem.numero).padStart(3, "0"))
              .replace("{aparelho}", aparelhoNome)
              .replace("{motivo}", rejectReason || "Não informado");
            abrirWhatsApp(empresaConfig.telefone, msg);
          }
        }
      } catch {}

      queryClient.invalidateQueries({ queryKey: ["portal-ordens"] });
      queryClient.invalidateQueries({ queryKey: ["portal-historico"] });
      setApprovalState("rejected");
      toast.success("Orçamento recusado");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao recusar orçamento");
      setApprovalState("idle");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <Header onBack={() => navigate("/portal")} user={user} onSignOut={signOut} />

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* OS Header */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Ordem de Serviço</p>
              <p className="text-2xl font-bold tracking-tight">#{String(ordem.numero).padStart(3, "0")}</p>
            </div>
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
              statusColors[ordem.status]?.bg,
              statusColors[ordem.status]?.text,
            )}>
              <span className={cn("h-2 w-2 rounded-full", statusColors[ordem.status]?.dot)} />
              {statusLabels[ordem.status as keyof typeof statusLabels] ?? ordem.status}
            </span>
          </div>
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
                    {i > 0 && <div className={cn("h-0.5 flex-1", done ? "bg-success" : "bg-border")} />}
                    <div className={cn(
                      "h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold",
                      isCurrent ? "bg-success text-success-foreground ring-2 ring-success/30" :
                      done ? "bg-success text-success-foreground" :
                      "bg-border text-muted-foreground"
                    )}>
                      {done ? "✓" : i + 1}
                    </div>
                    {i < steps.length - 1 && <div className={cn("h-0.5 flex-1", i < currentStepIdx ? "bg-success" : "bg-border")} />}
                  </div>
                  <span className={cn(
                    "text-[8px] sm:text-[9px] mt-1.5 text-center leading-tight",
                    isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}>
                    {stepLabels[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Approval card */}
        {isAguardandoAprovacao && approvalState !== "approved" && approvalState !== "rejected" && (
          <div className="rounded-xl border-2 border-warning/50 bg-warning/5 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-warning" />
              <p className="text-sm font-semibold">Orçamento aguardando sua aprovação</p>
            </div>

            {/* Defects */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Problema relatado:</p>
              <p className="text-sm">{ordem.defeito_relatado}</p>
            </div>

            {/* Financial breakdown */}
            <div className="space-y-1.5">
              {ordem.custo_pecas != null && Number(ordem.custo_pecas) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Peças</span>
                  <span className="font-medium">{fmt(ordem.custo_pecas)}</span>
                </div>
              )}
              {ordem.valor != null && (
                <>
                  {Number(ordem.custo_pecas ?? 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Mão de obra</span>
                      <span className="font-medium">{fmt((ordem.valor ?? 0) - (ordem.custo_pecas ?? 0))}</span>
                    </div>
                  )}
                  <div className="border-t pt-1.5 mt-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-base">{fmt(ordem.valor)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {ordem.previsao_entrega && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Previsão de entrega:</span>
                <span className="font-medium">{fmtDate(ordem.previsao_entrega)}</span>
              </div>
            )}

            {/* Action buttons */}
            {approvalState === "idle" && (
              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={() => setApprovalState("confirming_approve")}>
                  <Check className="h-4 w-4 mr-2" /> Aprovar Orçamento
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setApprovalState("confirming_reject")}>
                  <X className="h-4 w-4 mr-2" /> Recusar
                </Button>
              </div>
            )}

            {/* Confirm approve */}
            {approvalState === "confirming_approve" && (
              <div className="space-y-3 pt-1">
                <p className="text-sm text-center">
                  Confirma a aprovação do serviço por <strong>{fmt(ordem.valor)}</strong>?
                </p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleApprove}>
                    <Check className="h-4 w-4 mr-2" /> Confirmar Aprovação
                  </Button>
                  <Button variant="ghost" onClick={() => setApprovalState("idle")}>Voltar</Button>
                </div>
              </div>
            )}

            {/* Confirm reject */}
            {approvalState === "confirming_reject" && (
              <div className="space-y-3 pt-1">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Motivo da recusa (opcional)</p>
                  <Textarea
                    placeholder="Descreva o motivo..."
                    rows={2}
                    className="resize-none"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="destructive" className="flex-1" onClick={handleReject}>
                    <X className="h-4 w-4 mr-2" /> Confirmar Recusa
                  </Button>
                  <Button variant="ghost" onClick={() => setApprovalState("idle")}>Voltar</Button>
                </div>
              </div>
            )}

            {/* Saving */}
            {approvalState === "saving" && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}

        {/* Success states */}
        {approvalState === "approved" && (
          <div className="rounded-xl border-2 border-success/50 bg-success/5 p-5 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
            <p className="font-semibold">Orçamento aprovado!</p>
            <p className="text-sm text-muted-foreground">Seu aparelho entrará em reparo em breve.</p>
          </div>
        )}

        {approvalState === "rejected" && (
          <div className="rounded-xl border-2 border-muted bg-muted/30 p-5 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="font-semibold">Entendido.</p>
            <p className="text-sm text-muted-foreground">Entre em contato para combinar a retirada do aparelho.</p>
          </div>
        )}

        {/* Device details */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Detalhes</p>
          <DetailRow icon={Smartphone} label="Aparelho" value={`${aparelhoNome}${ordem.aparelhos?.cor ? ` (${ordem.aparelhos.cor})` : ""}`} />
          <DetailRow icon={FileText} label="Problema" value={ordem.defeito_relatado} />
          {ordem.lojas && <DetailRow icon={Store} label="Loja" value={ordem.lojas.nome} />}
          {ordem.tecnico && <DetailRow icon={User} label="Técnico" value={ordem.tecnico} />}
          <DetailRow icon={Clock} label="Entrada" value={fmtDate(ordem.data_entrada)} />
          {ordem.previsao_entrega && (
            <DetailRow icon={Clock} label="Previsão" value={fmtDate(ordem.previsao_entrega)} highlight />
          )}
          {ordem.data_entrega && (
            <DetailRow icon={CheckCircle2} label="Entregue em" value={fmtDate(ordem.data_entrega)} />
          )}
        </div>

        {/* Financial */}
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground mb-3">Financeiro</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-muted-foreground">Serviço</p>
              <p className="text-sm font-semibold">{fmt(ordem.valor)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Pago</p>
              <p className="text-sm font-semibold text-success">{fmt(ordem.valor_pago)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Pendente</p>
              <p className={cn("text-sm font-semibold", valorPendente > 0 ? "text-warning" : "text-success")}>
                {fmt(valorPendente)}
              </p>
            </div>
          </div>
        </div>

        {/* Observations */}
        {ordem.observacoes && (
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground mb-2">Observações</p>
            <p className="text-sm">{ordem.observacoes}</p>
          </div>
        )}

        {/* History */}
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground mb-3">Histórico</p>
          {loadingHist ? (
            <div className="py-4 flex justify-center">
              <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : historico.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum registro ainda</p>
          ) : (
            <div className="space-y-0">
              {historico.map((h, i) => {
                const isApproval = h.descricao?.includes("aprovado pelo cliente") || h.descricao?.includes("recusado pelo cliente");
                return (
                  <div key={h.id} className="flex gap-3 py-2">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "h-2.5 w-2.5 rounded-full mt-1",
                        isApproval ? "bg-warning" :
                        i === historico.length - 1 ? "bg-success" : "bg-border"
                      )} />
                      {i < historico.length - 1 && <div className="flex-1 w-px bg-border" />}
                    </div>
                    <div className="pb-1">
                      <p className="text-sm font-medium">
                        {statusLabels[h.status_novo as keyof typeof statusLabels] ?? h.status_novo}
                      </p>
                      {h.descricao && (
                        <p className={cn("text-xs mt-0.5", isApproval ? "text-warning font-medium" : "text-muted-foreground")}>
                          {h.descricao}
                        </p>
                      )}
                      {h.observacao && <p className="text-xs text-muted-foreground mt-0.5">{h.observacao}</p>}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(h.created_at).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", year: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ onBack, user, onSignOut }: { onBack: () => void; user: any; onSignOut: () => void }) {
  return (
    <header className="border-b bg-card sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1 hover:bg-muted rounded-md transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Wrench className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">Detalhes da OS</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={onSignOut}>
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </Button>
      </div>
    </header>
  );
}

function DetailRow({ icon: Icon, label, value, highlight }: {
  icon: any; label: string; value: string; highlight?: boolean;
}) {
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
