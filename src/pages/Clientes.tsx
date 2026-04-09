import { useState } from "react";
import { Plus, Search, Phone, Mail, Loader2, Pencil, X, MessageCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type ClienteComStats = {
  id: string;
  nome: string;
  telefone: string;
  whatsapp: string | null;
  email: string | null;
  cpf: string | null;
  observacoes: string | null;
  created_at: string;
  total_os: number;
  ultimo_atendimento: string | null;
  total_gasto: number;
};

async function fetchClientes(): Promise<ClienteComStats[]> {
  // Fetch clients
  const { data: clientes, error } = await supabase
    .from("clientes")
    .select("*")
    .order("nome");
  if (error) throw error;

  // Fetch order stats per client (via aparelhos)
  const { data: ordens } = await supabase
    .from("ordens_de_servico")
    .select("aparelho_id, valor, data_entrada, aparelhos!inner(cliente_id)");

  const statsMap = new Map<string, { count: number; total: number; lastDate: string | null }>();

  (ordens ?? []).forEach((o: any) => {
    const cid = o.aparelhos?.cliente_id;
    if (!cid) return;
    const prev = statsMap.get(cid) ?? { count: 0, total: 0, lastDate: null };
    prev.count++;
    prev.total += Number(o.valor ?? 0);
    if (!prev.lastDate || o.data_entrada > prev.lastDate) prev.lastDate = o.data_entrada;
    statsMap.set(cid, prev);
  });

  return clientes.map((c) => {
    const stats = statsMap.get(c.id) ?? { count: 0, total: 0, lastDate: null };
    return {
      ...c,
      total_os: stats.count,
      ultimo_atendimento: stats.lastDate,
      total_gasto: stats.total,
    };
  });
}

export default function Clientes() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClienteComStats | null>(null);
  const queryClient = useQueryClient();

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes-full"],
    queryFn: fetchClientes,
  });

  const filtered = clientes.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone.includes(search) ||
    (c.cpf && c.cpf.includes(search))
  );

  // Create
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
      queryClient.invalidateQueries({ queryKey: ["clientes-full"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setDialogOpen(false);
      toast.success("Cliente cadastrado!");
    },
    onError: () => toast.error("Erro ao cadastrar"),
  });

  // Update
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
      queryClient.invalidateQueries({ queryKey: ["clientes-full"] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setEditingClient(null);
      toast.success("Cliente atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
  const fmtCurrency = (v: number) => v ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` : "—";

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="page-header !mb-0">
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{clientes.length} cadastrados</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />Novo Cliente
        </Button>
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
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="hidden sm:table-cell">Telefone</th>
                  <th className="text-center">OS</th>
                  <th className="hidden md:table-cell">Último atend.</th>
                  <th className="hidden md:table-cell text-right">Total gasto</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <p className="text-sm font-medium">{c.nome}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">{c.telefone}</p>
                    </td>
                    <td className="hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{c.telefone}</span>
                      </div>
                      {c.whatsapp && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <MessageCircle className="h-3 w-3 text-success" />
                          <span className="text-xs text-muted-foreground">{c.whatsapp}</span>
                        </div>
                      )}
                    </td>
                    <td className="text-center">
                      <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full font-medium">{c.total_os}</span>
                    </td>
                    <td className="hidden md:table-cell text-sm text-muted-foreground">{fmtDate(c.ultimo_atendimento)}</td>
                    <td className="hidden md:table-cell text-sm font-medium text-right">{fmtCurrency(c.total_gasto)}</td>
                    <td>
                      <button
                        onClick={() => setEditingClient(c)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-10 text-sm">Nenhum cliente encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New client dialog */}
      <ClienteFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Novo Cliente"
        onSubmit={(fd) => createMutation.mutate(fd)}
        isPending={createMutation.isPending}
      />

      {/* Edit client sheet */}
      <Sheet open={!!editingClient} onOpenChange={(open) => { if (!open) setEditingClient(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {editingClient && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle>Editar Cliente</SheetTitle>
              </SheetHeader>
              <ClienteForm
                defaultValues={editingClient}
                onSubmit={(fd) => updateMutation.mutate({ id: editingClient.id, fd })}
                isPending={updateMutation.isPending}
                submitLabel="Salvar Alterações"
              />

              <Separator className="my-5" />

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Resumo</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm py-1.5 border-b">
                    <span className="text-muted-foreground">Ordens de serviço</span>
                    <span className="font-medium">{editingClient.total_os}</span>
                  </div>
                  <div className="flex justify-between text-sm py-1.5 border-b">
                    <span className="text-muted-foreground">Último atendimento</span>
                    <span className="font-medium">{fmtDate(editingClient.ultimo_atendimento)}</span>
                  </div>
                  <div className="flex justify-between text-sm py-1.5">
                    <span className="text-muted-foreground">Total gasto</span>
                    <span className="font-medium">{fmtCurrency(editingClient.total_gasto)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ── Reusable form ── */
function ClienteForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
}: {
  defaultValues?: Partial<ClienteComStats>;
  onSubmit: (fd: FormData) => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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

function ClienteFormDialog({
  open,
  onOpenChange,
  title,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onSubmit: (fd: FormData) => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="mt-2">
          <ClienteForm onSubmit={onSubmit} isPending={isPending} submitLabel="Cadastrar" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
