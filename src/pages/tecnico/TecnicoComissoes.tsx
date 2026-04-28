import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, CheckCircle2, Clock, DollarSign, ListChecks, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTecnicoIdentidade } from "@/hooks/useTecnico";
import { useMinhasComissoes, useMinhasComissoesResumo, type MinhaComissao } from "@/hooks/useMinhasComissoes";
import { cn } from "@/lib/utils";

type PeriodPreset = "atual" | "anterior" | "3m" | "custom";

const STATUS_CONFIG: Record<MinhaComissao["status"], { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "border-muted bg-muted/60 text-muted-foreground" },
  liberada: { label: "Liberada", className: "border-info/30 bg-info/10 text-info" },
  paga: { label: "Paga", className: "border-success/30 bg-success/10 text-success" },
  estornada: { label: "Estornada", className: "border-destructive/30 bg-destructive/10 text-destructive" },
};

function toMes(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function fmtMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
}

export default function TecnicoComissoes() {
  const { data: identidade } = useTecnicoIdentidade();
  const hoje = new Date();
  const [preset, setPreset] = useState<PeriodPreset>("atual");
  const [customMes, setCustomMes] = useState(String(hoje.getMonth() + 1).padStart(2, "0"));
  const [customAno, setCustomAno] = useState(String(hoje.getFullYear()));

  const meses = useMemo(() => {
    if (preset === "anterior") return [toMes(addMonths(hoje, -1))];
    if (preset === "3m") return [toMes(hoje), toMes(addMonths(hoje, -1)), toMes(addMonths(hoje, -2))];
    if (preset === "custom") return [`${customAno}-${customMes}`];
    return [toMes(hoje)];
  }, [preset, customAno, customMes]);

  const periodoLabel = preset === "3m"
    ? "Últimos 3 meses"
    : format(new Date(`${meses[0]}-01T00:00:00`), "MMMM 'de' yyyy", { locale: ptBR });

  const { data: comissoes = [], isLoading } = useMinhasComissoes(identidade?.funcionario_id, meses);
  const { data: resumo } = useMinhasComissoesResumo(identidade?.funcionario_id, meses);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Portal do Técnico</p>
        <h1 className="text-2xl font-semibold tracking-tight">Minhas Comissões</h1>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-primary">Total a receber</p>
              <p className="text-3xl font-semibold tracking-tight">{fmtMoney(resumo?.totalReceber ?? 0)}</p>
              <p className="text-xs text-muted-foreground">{periodoLabel}</p>
            </div>
            <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant={preset === "atual" ? "default" : "outline"} onClick={() => setPreset("atual")}>Este mês</Button>
            <Button size="sm" variant={preset === "anterior" ? "default" : "outline"} onClick={() => setPreset("anterior")}>Anterior</Button>
            <Button size="sm" variant={preset === "3m" ? "default" : "outline"} onClick={() => setPreset("3m")}>3 meses</Button>
          </div>

          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <Select value={customMes} onValueChange={(value) => { setCustomMes(value); setPreset("custom"); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((mes) => (
                  <SelectItem key={mes} value={mes}>{format(new Date(`${hoje.getFullYear()}-${mes}-01T00:00:00`), "MMMM", { locale: ptBR })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={customAno} onValueChange={(value) => { setCustomAno(value); setPreset("custom"); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 4 }, (_, i) => String(hoje.getFullYear() - i)).map((ano) => <SelectItem key={ano} value={ano}>{ano}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="icon" variant={preset === "custom" ? "default" : "outline"} onClick={() => setPreset("custom")} aria-label="Aplicar mês personalizado">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <ResumoCard icon={Wallet} label="A receber" value={fmtMoney(resumo?.totalReceber ?? 0)} />
        <ResumoCard icon={CheckCircle2} label="Pago" value={fmtMoney(resumo?.totalPaga ?? 0)} />
        <ResumoCard icon={ListChecks} label="Serviços" value={resumo?.countTotal ?? 0} />
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Comissões</h2>
          <span className="text-xs text-muted-foreground">{comissoes.length} item(ns)</span>
        </div>

        {isLoading ? (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Carregando comissões...</CardContent></Card>
        ) : comissoes.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhuma comissão neste período
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {comissoes.map((comissao) => <ComissaoItem key={comissao.id} comissao={comissao} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function ResumoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-3 min-h-[82px]">
        <Icon className="h-4 w-4 text-muted-foreground mb-1" />
        <p className="text-sm font-semibold leading-tight break-words">{value}</p>
        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      </CardContent>
    </Card>
  );
}

function ComissaoItem({ comissao }: { comissao: MinhaComissao }) {
  const status = STATUS_CONFIG[comissao.status];
  const aparelho = [comissao.ordens_de_servico?.aparelhos?.marca, comissao.ordens_de_servico?.aparelhos?.modelo].filter(Boolean).join(" ");
  const data = comissao.status === "paga" ? comissao.data_pagamento : comissao.created_at;

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{comissao.os_servicos?.nome ?? "Serviço"}</p>
            <p className="text-xs text-muted-foreground truncate">
              OS #{comissao.ordens_de_servico?.numero_formatado || comissao.ordens_de_servico?.numero || "—"}{aparelho ? ` - ${aparelho}` : ""}
            </p>
          </div>
          <p className="text-sm font-semibold whitespace-nowrap">{fmtMoney(Number(comissao.valor ?? 0))}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className={cn("text-[10px]", status.className)}>{status.label}</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> {fmtDate(data)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}