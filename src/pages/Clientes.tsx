import { useMemo, useState, type FormEvent } from "react";
import { ArrowDownUp, Loader2, MessageCircle, Pencil, Phone, Plus, Search, TrendingUp, Users, Wallet, Wrench } from "lucide-react";
import { ClienteHistorico } from "@/components/ClienteHistoricoSheet";
import { NovaOrdemDialog } from "@/components/NovaOrdemDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { usePermissoes } from "@/hooks/usePermissoes";
import { useClientesSaldos, type ClienteSaldoResumo } from "@/hooks/useClientesSaldos";

type SortKey = "saldo_devedor" | "total_faturado" | "qtd_oss";
type SortDirection = "asc" | "desc";

export default function Clientes() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClienteSaldoResumo | null>(null);
  const [viewingClient, setViewingClient] = useState<ClienteSaldoResumo | null>(null);
  const [novaOsOpen, setNovaOsOpen] = useState(false);
  const [novaOsClienteId, setNovaOsClienteId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("saldo_devedor");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const queryClient = useQueryClient();
  const { can } = usePermissoes();

  const { data: clientes = [], isLoading } = useClientesSaldos();

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return clientes
      .filter((c) =>
        c.nome.toLowerCase().includes(term) ||
        c.telefone.includes(search) ||
        (c.cpf && c.cpf.includes(search))
      )
      .sort((a, b) => {
        const diff = Number(a[sortKey] ?? 0) - Number(b[sortKey] ?? 0);
        return sortDirection === "asc" ? diff : -diff;
      });
  }, [clientes, search, sortDirection, sortKey]);

  const kpis = useMemo(() => ({
    totalAReceber: filtered.reduce((sum, c) => sum + Math.max(Number(c.saldo_devedor ?? 0), 0), 0),
    clientesComDebito: filtered.filter((c) => Number(c.saldo_devedor ?? 0) > 0).length,
    totalFaturado: filtered.reduce((sum, c) => sum + Number(c.total_faturado ?? 0), 0),
  }), [filtered]);

  const createMutation = useMutation({
    mutationFn: async (fd: FormData) => {
      const { error } = await supabase.from("clientes").insert({
        nome: fd.get("nome") as string,
        telefone: fd.get("telefone") as string,
        whatsapp: (fd.get("whatsapp") as string) || null,
        email: (fd.get("email") as string) || null,
        cpf: (fd.get("cpf") as string) || null,
        observacoes: (fd.get("observacoes") as string) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes-saldos"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setDialogOpen(false);
      toast.success("Cliente cadastrado!");
    },
    onError: () => toast.error("Erro ao cadastrar"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, fd }: { id: string; fd: FormData }) => {
      const { error } = await supabase.from("clientes").update({
        nome: fd.get("nome") as string,
        telefone: fd.get("telefone") as string,
        whatsapp: (fd.get("whatsapp") as string) || null,
        email: (fd.get("email") as string) || null,
        cpf: (fd.get("cpf") as string) || null,
        observacoes: (fd.get("observacoes") as string) || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes-saldos"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setEditingClient(null);
      toast.success("Cliente atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const fmtDate = (d: string | null) => d ? new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR") : "—";
  const fmtCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const saldoClass = (saldo: number) => saldo > 0 ? "text-destructive" : saldo < 0 ? "text-success" : "text-muted-foreground";

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => current === "desc" ? "asc" : "desc");
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  };

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="page-header !mb-0">
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{clientes.length} cadastrados</p>
        </div>
        {can("clientes", "criar") && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Novo Cliente
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard icon={Wallet} label="Total a receber" value={fmtCurrency(kpis.totalAReceber)} />
        <KpiCard icon={Users} label="Clientes com débito" value={String(kpis.clientesComDebito)} />
        <KpiCard icon={TrendingUp} label="Total faturado geral" value={fmtCurrency(kpis.totalFaturado)} />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, telefone ou CPF..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="section-card">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[1040px]">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="text-center"><SortButton active={sortKey === "qtd_oss"} label="OSs" onClick={() => toggleSort("qtd_oss")} /></th>
                  <th className="text-right"><SortButton active={sortKey === "total_faturado"} label="Total Faturado" onClick={() => toggleSort("total_faturado")} /></th>
                  <th className="text-right">Total Recebido</th>
                  <th className="text-right"><SortButton active={sortKey === "saldo_devedor"} label="Saldo Devedor" onClick={() => toggleSort("saldo_devedor")} /></th>
                  <th>Última OS</th>
                  <th>Último Pagamento</th>
                  <th className="w-10">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewingClient(c)}>
                    <td>
                      <p className="text-sm font-medium text-primary hover:underline">{c.nome}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {c.telefone || "—"}
                        {c.whatsapp ? <MessageCircle className="h-3 w-3 text-success" /> : null}
                      </div>
                    </td>
                    <td className="text-center">
                      <button className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium hover:bg-secondary/80" onClick={(e) => { e.stopPropagation(); setViewingClient(c); }}>
                        {c.qtd_oss}
                      </button>
                    </td>
                    <td className="text-sm font-medium text-right">{fmtCurrency(Number(c.total_faturado ?? 0))}</td>
                    <td className="text-sm text-muted-foreground text-right">{fmtCurrency(Number(c.total_recebido ?? 0))}</td>
                    <td className={`text-sm font-semibold text-right ${saldoClass(Number(c.saldo_devedor ?? 0))}`}>{fmtCurrency(Number(c.saldo_devedor ?? 0))}</td>
                    <td className="text-sm text-muted-foreground">{fmtDate(c.ultima_os_data)}</td>
                    <td className="text-sm text-muted-foreground">{fmtDate(c.ultimo_pagamento_data)}</td>
                    <td>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {can("clientes", "editar") && (
                          <button onClick={() => setEditingClient(c)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" aria-label="Editar cliente">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <Users className="h-10 w-10 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">{search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}</p>
                        {!search && <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo Cliente</Button>}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ClienteFormDialog open={dialogOpen} onOpenChange={setDialogOpen} title="Novo Cliente" onSubmit={(fd) => createMutation.mutate(fd)} isPending={createMutation.isPending} />

      <Sheet open={!!editingClient} onOpenChange={(open) => { if (!open) setEditingClient(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {editingClient && (
            <>
              <SheetHeader className="pb-4"><SheetTitle>{editingClient.nome}</SheetTitle></SheetHeader>
              <ClienteHistorico cliente={editingClient} />
              <Separator className="my-4" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dados Cadastrais</p>
              <ClienteForm defaultValues={editingClient} onSubmit={(fd) => updateMutation.mutate({ id: editingClient.id, fd })} isPending={updateMutation.isPending} submitLabel="Salvar Alterações" />
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!viewingClient} onOpenChange={(open) => { if (!open) setViewingClient(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {viewingClient && (
            <>
              <SheetHeader className="pb-4"><SheetTitle>{viewingClient.nome}</SheetTitle></SheetHeader>
              <Button
                size="sm"
                className="w-full mb-4 gap-1.5"
                onClick={() => {
                  setNovaOsClienteId(viewingClient.id);
                  setNovaOsOpen(true);
                }}
              >
                <Wrench className="h-3.5 w-3.5" />
                Nova OS para este cliente
              </Button>
              <ClienteHistorico cliente={viewingClient} />
            </>
          )}
        </SheetContent>
      </Sheet>

      <NovaOrdemDialog
        open={novaOsOpen}
        onOpenChange={setNovaOsOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["clientes-saldos"] });
          setNovaOsOpen(false);
        }}
        preSelectedClientId={novaOsClienteId}
      />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function SortButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : "text-muted-foreground"}`}>
      {label}<ArrowDownUp className="h-3 w-3" />
    </button>
  );
}

function ClienteForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
}: {
  defaultValues?: Partial<ClienteSaldoResumo>;
  onSubmit: (fd: FormData) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(new FormData(e.currentTarget));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <div><Label className="text-xs">Nome</Label><Input name="nome" required defaultValue={defaultValues?.nome} placeholder="Nome completo" className="mt-1.5" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Telefone</Label><Input name="telefone" required defaultValue={defaultValues?.telefone} placeholder="(00) 00000-0000" className="mt-1.5" /></div>
          <div><Label className="text-xs">WhatsApp</Label><Input name="whatsapp" defaultValue={defaultValues?.whatsapp ?? ""} placeholder="(00) 00000-0000" className="mt-1.5" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Email</Label><Input name="email" type="email" defaultValue={defaultValues?.email ?? ""} placeholder="email@exemplo.com" className="mt-1.5" /></div>
          <div><Label className="text-xs">CPF (opcional)</Label><Input name="cpf" defaultValue={defaultValues?.cpf ?? ""} placeholder="000.000.000-00" className="mt-1.5" /></div>
        </div>
        <div><Label className="text-xs">Observações</Label><Textarea name="observacoes" defaultValue={defaultValues?.observacoes ?? ""} placeholder="Anotações sobre o cliente..." rows={2} className="mt-1.5 resize-none" /></div>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}

function ClienteFormDialog({ open, onOpenChange, title, onSubmit, isPending }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; onSubmit: (fd: FormData) => void; isPending: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="mt-2"><ClienteForm onSubmit={onSubmit} isPending={isPending} submitLabel="Cadastrar" /></div>
      </DialogContent>
    </Dialog>
  );
}
