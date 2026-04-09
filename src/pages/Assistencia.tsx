import { useState } from "react";
import { Plus, Search, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, allStatuses } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["status_ordem"];

// Fetch orders with joined client + device data
async function fetchOrders() {
  const { data, error } = await supabase
    .from("ordens_de_servico")
    .select(`
      *,
      aparelhos (
        marca,
        modelo,
        clientes (
          nome,
          telefone
        )
      )
    `)
    .order("data_entrada", { ascending: false });

  if (error) throw error;
  return data;
}

export default function Assistencia() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["ordens"],
    queryFn: fetchOrders,
  });

  // For the "new order" dialog, we need clients list
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (form: {
      clienteId: string;
      marca: string;
      modelo: string;
      defeito: string;
      tecnico: string;
      previsao: string;
    }) => {
      // Create device
      const { data: aparelho, error: apError } = await supabase
        .from("aparelhos")
        .insert({ cliente_id: form.clienteId, marca: form.marca, modelo: form.modelo })
        .select()
        .single();
      if (apError) throw apError;

      // Create order
      const { error: osError } = await supabase
        .from("ordens_de_servico")
        .insert({
          aparelho_id: aparelho.id,
          defeito_relatado: form.defeito,
          tecnico: form.tecnico || null,
          previsao_entrega: form.previsao || null,
          status: "recebido" as Status,
        });
      if (osError) throw osError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      setDialogOpen(false);
      toast.success("Ordem de serviço criada!");
    },
    onError: () => toast.error("Erro ao criar ordem"),
  });

  const handleNew = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      clienteId: fd.get("clienteId") as string,
      marca: fd.get("marca") as string,
      modelo: fd.get("modelo") as string,
      defeito: fd.get("defeito") as string,
      tecnico: fd.get("tecnico") as string,
      previsao: fd.get("previsao") as string,
    });
  };

  const filtered = orders.filter((o) => {
    const clientName = o.aparelhos?.clientes?.nome ?? "";
    const clientPhone = o.aparelhos?.clientes?.telefone ?? "";
    const device = `${o.aparelhos?.marca ?? ""} ${o.aparelhos?.modelo ?? ""}`;
    const q = search.toLowerCase();
    const matchSearch = !search || clientName.toLowerCase().includes(q) || clientPhone.includes(q) || device.toLowerCase().includes(q) || String(o.numero).includes(q);
    const matchStatus = filterStatus === "todos" || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR");
  };

  const formatCurrency = (v: number | null) => {
    if (!v) return "—";
    return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
  };

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="page-header !mb-0">
          <h1 className="page-title">Assistência Técnica</h1>
          <p className="page-subtitle">{filtered.length} ordens de serviço</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1.5" />Nova Ordem</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Nova Ordem de Serviço</DialogTitle></DialogHeader>
            <form onSubmit={handleNew} className="space-y-4 mt-2">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Cliente</Label>
                  <Select name="clienteId" required>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Marca</Label><Input name="marca" required placeholder="Apple, Samsung..." className="mt-1.5" /></div>
                  <div><Label className="text-xs">Modelo</Label><Input name="modelo" required placeholder="iPhone 15, S24..." className="mt-1.5" /></div>
                </div>
                <div><Label className="text-xs">Defeito relatado</Label><Textarea name="defeito" required placeholder="Descreva o problema" rows={2} className="mt-1.5 resize-none" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Técnico (opcional)</Label><Input name="tecnico" placeholder="Nome" className="mt-1.5" /></div>
                  <div><Label className="text-xs">Previsão entrega</Label><Input name="previsao" type="date" className="mt-1.5" /></div>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Criar Ordem
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente, telefone ou aparelho..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {allStatuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="section-card">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>OS</th>
                  <th>Cliente / Aparelho</th>
                  <th className="hidden lg:table-cell">Defeito</th>
                  <th>Status</th>
                  <th className="hidden md:table-cell">Entrada</th>
                  <th className="hidden md:table-cell">Previsão</th>
                  <th className="hidden sm:table-cell">Técnico</th>
                  <th className="text-right hidden sm:table-cell">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id}>
                    <td className="font-mono text-xs text-muted-foreground">#{String(order.numero).padStart(3, "0")}</td>
                    <td>
                      <p className="font-medium text-sm">{order.aparelhos?.clientes?.nome ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{order.aparelhos?.marca} {order.aparelhos?.modelo}</p>
                    </td>
                    <td className="hidden lg:table-cell text-sm text-muted-foreground max-w-48 truncate">{order.defeito_relatado}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(order.data_entrada)}</td>
                    <td className="hidden md:table-cell text-sm text-muted-foreground">{formatDate(order.previsao_entrega)}</td>
                    <td className="hidden sm:table-cell text-sm">{order.tecnico ?? "—"}</td>
                    <td className="hidden sm:table-cell text-sm font-medium text-right">{formatCurrency(order.valor)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-muted-foreground py-10 text-sm">Nenhuma ordem encontrada</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
