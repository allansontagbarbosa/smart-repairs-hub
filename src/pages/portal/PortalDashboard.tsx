import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  LogOut, Smartphone, Clock, CheckCircle2, Package,
  DollarSign, ChevronRight, Store, Filter, Search,
} from "lucide-react";
import { AssistProLogo } from "@/components/AssistProLogo";
import { useAuth } from "@/contexts/AuthContext";
import { usePortalCliente, usePortalLojas, usePortalOrdens, type PortalOrdem } from "@/hooks/usePortalData";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { statusLabelsCliente as statusLabels } from "@/lib/status";


const statusColors: Record<string, string> = {
  recebido: "bg-muted text-muted-foreground",
  em_analise: "bg-info-muted text-info",
  aguardando_aprovacao: "bg-warning-muted text-warning",
  aprovado: "bg-success-muted text-success",
  em_reparo: "bg-info-muted text-info",
  aguardando_peca: "bg-warning-muted text-warning",
  pronto: "bg-success-muted text-success",
  entregue: "bg-muted text-muted-foreground",
};

function fmt(v: number | null | undefined) {
  return `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function PortalDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: cliente, isLoading: loadingCliente } = usePortalCliente();
  const { data: lojas = [] } = usePortalLojas(cliente?.id);
  const [lojaFilter, setLojaFilter] = useState("todas");
  const [statusFilter, setStatusFilter] = useState("todos");
  const { data: ordens = [], isLoading: loadingOrdens } = usePortalOrdens(cliente?.id, lojaFilter);

  // If not logged in, redirect to portal login (search page)
  if (!user) {
    return <Navigate to="/portal/login" replace />;
  }

  const filtered = statusFilter === "todos"
    ? ordens
    : ordens.filter((o) => o.status === statusFilter);

  const emAndamento = ordens.filter((o) => !["pronto", "entregue"].includes(o.status));
  const prontos = ordens.filter((o) => o.status === "pronto");
  const entregues = ordens.filter((o) => o.status === "entregue");
  const totalAberto = ordens.reduce((sum, o) => sum + (o.valor_pendente ?? ((o.valor ?? 0) - (o.valor_pago ?? 0))), 0);

  if (loadingCliente) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="min-h-screen bg-background">
        <PortalHeader user={user} onSignOut={signOut} />
        <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
          <Smartphone className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">Conta não vinculada</h2>
          <p className="text-sm text-muted-foreground">
            Seu email ({user?.email}) ainda não está vinculado a um cadastro de cliente.
            Entre em contato com a assistência para vincular sua conta.
          </p>
          <Button variant="outline" onClick={() => navigate("/portal/login")}>
            <Search className="h-4 w-4 mr-2" />
            Consultar por número da OS
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <PortalHeader user={user} onSignOut={signOut} />

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Olá, {cliente.nome.split(" ")[0]}!</h1>
          <p className="text-sm text-muted-foreground">Acompanhe seus aparelhos na assistência</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard icon={Clock} label="Em andamento" value={emAndamento.length} color="text-info" />
          <SummaryCard icon={CheckCircle2} label="Prontos" value={prontos.length} color="text-success" />
          <SummaryCard icon={Package} label="Entregues" value={entregues.length} color="text-muted-foreground" />
          <SummaryCard icon={DollarSign} label="Em aberto" value={fmt(totalAberto)} color="text-warning" />
        </div>

        <div className="flex gap-2 flex-wrap">
          {lojas.length > 1 && (
            <Select value={lojaFilter} onValueChange={setLojaFilter}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <Store className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Todas as lojas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as lojas</SelectItem>
                {lojas.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(statusLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {lojas.length > 1 && lojaFilter === "todas" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lojas.map((loja) => {
              const lojaOrdens = ordens.filter((o) => o.lojas?.id === loja.id);
              const aberto = lojaOrdens.reduce((s, o) => s + (o.valor_pendente ?? ((o.valor ?? 0) - (o.valor_pago ?? 0))), 0);
              const andamento = lojaOrdens.filter((o) => !["pronto", "entregue"].includes(o.status)).length;
              return (
                <button
                  key={loja.id}
                  onClick={() => setLojaFilter(loja.id)}
                  className="rounded-xl border bg-card p-4 text-left hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{loja.nome}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{andamento} em andamento</span>
                    <span>{fmt(aberto)} em aberto</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {loadingOrdens ? (
          <div className="py-8 flex justify-center">
            <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum aparelho encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((ordem) => (
              <button
                key={ordem.id}
                onClick={() => navigate(`/portal/ordem/${ordem.id}`)}
                className="w-full rounded-xl border bg-card p-4 text-left hover:border-primary/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {ordem.aparelhos?.marca} {ordem.aparelhos?.modelo}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      OS #{String(ordem.numero).padStart(3, "0")}
                      {ordem.lojas ? ` • ${ordem.lojas.nome}` : ""}
                    </p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                    statusColors[ordem.status] ?? "bg-muted text-muted-foreground"
                  )}>
                    {statusLabels[ordem.status] ?? ordem.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span>{new Date(ordem.data_entrada).toLocaleDateString("pt-BR")}</span>
                  {ordem.valor ? <span className="font-medium text-foreground">{fmt(ordem.valor)}</span> : null}
                  {(ordem.valor_pendente ?? 0) > 0 && (
                    <span className="text-warning font-medium">
                      {fmt(ordem.valor_pendente)} pendente
                    </span>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PortalHeader({ user, onSignOut }: { user: any; onSignOut: () => void }) {
  return (
    <header className="border-b bg-card sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <AssistProLogo size="sm" />
          <p className="text-[10px] text-muted-foreground ml-1">Portal do Cliente</p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={onSignOut}>
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </Button>
      </div>
    </header>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string | number; color: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold tracking-tight">{value}</p>
    </div>
  );
}
