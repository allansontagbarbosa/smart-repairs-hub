import { useState } from "react";
import { Plus, Search, Loader2, Pencil, ClipboardCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NovaOrdemDialog } from "@/components/NovaOrdemDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAlertasEstoque } from "@/hooks/useAlertasEstoque";
import { AlertsBanner } from "@/components/AlertsBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type StatusEstoque = Database["public"]["Enums"]["status_estoque_aparelho"];
type Aparelho = Database["public"]["Tables"]["estoque_aparelhos"]["Row"];

const statusConfig: Record<StatusEstoque, { label: string; dot: string; text: string; bg: string }> = {
  disponivel: { label: "Disponível", dot: "bg-success", text: "text-success", bg: "bg-success-muted" },
  em_assistencia: { label: "Em Assistência", dot: "bg-info", text: "text-info", bg: "bg-info-muted" },
  em_transporte: { label: "Em Transporte", dot: "bg-warning", text: "text-warning", bg: "bg-warning-muted" },
  vendido: { label: "Vendido", dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-muted" },
};

const allStatusOptions: { value: StatusEstoque | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "disponivel", label: "Disponível" },
  { value: "em_assistencia", label: "Em Assistência" },
  { value: "em_transporte", label: "Em Transporte" },
  { value: "vendido", label: "Vendido" },
];

function StatusBadgeEstoque({ status }: { status: StatusEstoque }) {
  const c = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", c.bg, c.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}

async function fetchAparelhos() {
  const { data, error } = await supabase
    .from("estoque_aparelhos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

const fmt = (v: number | null) => {
  if (!v) return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
};

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
};

export default function Estoque() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [novaOSOpen, setNovaOSOpen] = useState(false);
  const [editItem, setEditItem] = useState<Aparelho | null>(null);
  const queryClient = useQueryClient();

  const { data: aparelhos = [], isLoading } = useQuery({
    queryKey: ["estoque_aparelhos"],
    queryFn: fetchAparelhos,
  });

  const alertasEstoque = useAlertasEstoque(aparelhos);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Aparelho> }) => {
      const { error } = await supabase.from("estoque_aparelhos").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque_aparelhos"] });
      setEditItem(null);
      toast.success("Aparelho atualizado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = aparelhos.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      a.modelo.toLowerCase().includes(q) ||
      a.marca.toLowerCase().includes(q) ||
      (a.imei ?? "").toLowerCase().includes(q) ||
      (a.cor ?? "").toLowerCase().includes(q);
    const matchStatus = filterStatus === "todos" || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const countByStatus = (s: StatusEstoque) => aparelhos.filter((a) => a.status === s).length;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="page-header !mb-0">
          <h1 className="page-title">Estoque de Aparelhos</h1>
          <p className="page-subtitle">
            {aparelhos.length} aparelhos · {countByStatus("disponivel")} disponíveis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/estoque/conferencia"
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            Conferência
          </Link>
          <Button size="sm" onClick={() => setNovaOSOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Nova OS
          </Button>
        </div>
      </div>
      {alertasEstoque.length > 0 && (
        <AlertsBanner alertas={alertasEstoque} max={4} />
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por IMEI, modelo, marca ou cor..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-44 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allStatusOptions.map((s) => (
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
                  <th>Aparelho</th>
                  <th className="hidden lg:table-cell">IMEI</th>
                  <th>Status</th>
                  <th className="hidden md:table-cell">Localização</th>
                  <th className="hidden sm:table-cell">Entrada</th>
                  <th className="text-right hidden sm:table-cell">Custo</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <p className="font-medium text-sm">{item.marca} {item.modelo}</p>
                      <p className="text-xs text-muted-foreground">
                        {[item.capacidade, item.cor].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="hidden lg:table-cell text-sm font-mono text-muted-foreground">
                      {item.imei ?? "—"}
                    </td>
                    <td>
                      <StatusBadgeEstoque status={item.status} />
                    </td>
                    <td className="hidden md:table-cell text-sm text-muted-foreground">
                      {item.localizacao ?? "—"}
                    </td>
                    <td className="hidden sm:table-cell text-sm text-muted-foreground">
                      {fmtDate(item.data_entrada)}
                    </td>
                    <td className="text-right hidden sm:table-cell text-sm font-medium">
                      {fmt(item.custo_compra)}
                    </td>
                    <td>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditItem(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground py-10 text-sm">
                      Nenhum aparelho encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NovaOrdemDialog
        open={novaOSOpen}
        onOpenChange={setNovaOSOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["estoque_aparelhos"] })}
      />

      {/* Edit Sheet */}
      <Sheet open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Editar Aparelho</SheetTitle></SheetHeader>
          {editItem && (
            <form
              className="space-y-4 mt-6"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                updateMutation.mutate({
                  id: editItem.id,
                  data: {
                    marca: fd.get("marca") as string,
                    modelo: fd.get("modelo") as string,
                    capacidade: (fd.get("capacidade") as string) || null,
                    cor: (fd.get("cor") as string) || null,
                    imei: (fd.get("imei") as string) || null,
                    custo_compra: Number(fd.get("custo_compra")) || 0,
                    fornecedor: (fd.get("fornecedor") as string) || null,
                    localizacao: (fd.get("localizacao") as string) || null,
                    status: fd.get("status") as StatusEstoque,
                    observacoes: (fd.get("observacoes") as string) || null,
                  },
                });
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Marca *</Label><Input name="marca" required defaultValue={editItem.marca} className="mt-1.5" /></div>
                <div><Label className="text-xs">Modelo *</Label><Input name="modelo" required defaultValue={editItem.modelo} className="mt-1.5" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Capacidade</Label><Input name="capacidade" defaultValue={editItem.capacidade ?? ""} className="mt-1.5" /></div>
                <div><Label className="text-xs">Cor</Label><Input name="cor" defaultValue={editItem.cor ?? ""} className="mt-1.5" /></div>
              </div>
              <div><Label className="text-xs">IMEI *</Label><Input name="imei" required defaultValue={editItem.imei ?? ""} className="mt-1.5" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Custo (R$)</Label><Input name="custo_compra" type="number" min={0} step="0.01" defaultValue={editItem.custo_compra ?? 0} className="mt-1.5" /></div>
                <div><Label className="text-xs">Fornecedor</Label><Input name="fornecedor" defaultValue={(editItem as any).fornecedor ?? ""} className="mt-1.5" /></div>
              </div>
              <div><Label className="text-xs">Localização</Label><Input name="localizacao" defaultValue={editItem.localizacao ?? ""} className="mt-1.5" /></div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select name="status" defaultValue={editItem.status}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allStatusOptions.filter(s => s.value !== "todos").map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Observações</Label><Textarea name="observacoes" rows={2} defaultValue={editItem.observacoes ?? ""} className="mt-1.5" /></div>
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Salvar
              </Button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
