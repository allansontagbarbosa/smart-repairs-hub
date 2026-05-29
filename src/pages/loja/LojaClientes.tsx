import { useState } from "react";
import { Plus, Search, Users, Eye, Star, AlertTriangle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, maskCPF } from "@/lib/utils";
import { NovoClienteDialog } from "@/components/loja/NovoClienteDialog";

type Tag = "vip" | "regular" | "problema" | "blacklist" | "novo";
type TabValue = "todos" | Tag;

function TagBadge({ tag }: { tag: Tag }) {
  const map: Record<Tag, { label: string; cls: string; icon?: JSX.Element }> = {
    vip: { label: "VIP", cls: "bg-warning/15 text-warning border-warning/30", icon: <Star className="h-3 w-3 mr-1" /> },
    regular: { label: "Regular", cls: "bg-muted text-muted-foreground border-transparent" },
    novo: { label: "Novo", cls: "bg-info/15 text-info border-info/30" },
    problema: { label: "Problema", cls: "bg-warning/15 text-warning border-warning/30", icon: <AlertTriangle className="h-3 w-3 mr-1" /> },
    blacklist: { label: "Blacklist", cls: "bg-destructive/15 text-destructive border-destructive/30", icon: <Ban className="h-3 w-3 mr-1" /> },
  };
  const m = map[tag];
  return (
    <Badge variant="outline" className={m.cls}>
      {m.icon}
      {m.label}
    </Badge>
  );
}

export default function LojaClientes() {
  const { empresaId } = useEmpresa();
  const [tab, setTab] = useState<TabValue>("todos");
  const [busca, setBusca] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["loja-clientes", empresaId, tab, busca],
    queryFn: async () => {
      let q = (supabase as any)
        .from("loja_clientes")
        .select("*")
        .eq("empresa_id", empresaId)
        .is("deleted_at", null);
      if (tab !== "todos") q = q.eq("tag", tab);
      if (busca) q = q.or(`nome.ilike.%${busca}%,cpf.ilike.%${busca}%,telefone.ilike.%${busca}%`);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const { data: counts } = useQuery({
    queryKey: ["loja-clientes-counts", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("loja_clientes")
        .select("tag")
        .eq("empresa_id", empresaId)
        .is("deleted_at", null);
      if (error) throw error;
      const c = { total: data?.length ?? 0, vip: 0, regular: 0, problema: 0, blacklist: 0, novo: 0 };
      (data ?? []).forEach((r: any) => {
        if (r.tag in c) (c as any)[r.tag]++;
      });
      return c;
    },
    enabled: !!empresaId,
  });

  const semDados = !isLoading && clientes.length === 0 && !busca && tab === "todos";

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Clientes Loja</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Base de clientes do varejo · separada da Assistência
          </p>
        </div>
        <Button onClick={() => setNovoOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo cliente
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">TOTAL DE CLIENTES</p>
          <p className="text-2xl font-bold mt-1">{counts?.total ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">VIP</p>
          <p className="text-2xl font-bold mt-1">{counts?.vip ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">PROBLEMA</p>
          <p className="text-2xl font-bold mt-1">{counts?.problema ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">BLACKLIST</p>
          <p className="text-2xl font-bold mt-1">{counts?.blacklist ?? 0}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="mb-4">
        <TabsList>
          <TabsTrigger value="todos">Todos {counts && <span className="ml-1 text-xs opacity-70">{counts.total}</span>}</TabsTrigger>
          <TabsTrigger value="vip">VIP {counts && <span className="ml-1 text-xs opacity-70">{counts.vip}</span>}</TabsTrigger>
          <TabsTrigger value="regular">Regulares {counts && <span className="ml-1 text-xs opacity-70">{counts.regular}</span>}</TabsTrigger>
          <TabsTrigger value="novo">Novos {counts && <span className="ml-1 text-xs opacity-70">{counts.novo}</span>}</TabsTrigger>
          <TabsTrigger value="problema">Problema {counts && <span className="ml-1 text-xs opacity-70">{counts.problema}</span>}</TabsTrigger>
          <TabsTrigger value="blacklist">Blacklist {counts && <span className="ml-1 text-xs opacity-70">{counts.blacklist}</span>}</TabsTrigger>
        </TabsList>
      </Tabs>

      {semDados ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Users className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Nenhum cliente cadastrado</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            Cadastre clientes pra registrar histórico de compras, limite de crédito e tags (VIP, Blacklist).
          </p>
          <Button onClick={() => setNovoOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Cadastrar primeiro cliente
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou telefone..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">CPF</th>
                  <th className="text-left p-3">Telefone</th>
                  <th className="text-right p-3">Limite</th>
                  <th className="text-left p-3">Score</th>
                  <th className="text-left p-3">Tag</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c: any) => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3 font-medium">{c.nome}</td>
                    <td className="p-3 text-muted-foreground font-mono text-xs">{maskCPF(c.cpf ?? "")}</td>
                    <td className="p-3 text-muted-foreground">{c.telefone ?? "—"}</td>
                    <td className="p-3 text-right">{c.limite_credito ? formatBRL(c.limite_credito) : "—"}</td>
                    <td className="p-3 text-warning">
                      <span aria-label={`Score ${c.score_interno} de 5`}>
                        {"★".repeat(c.score_interno)}
                        <span className="text-muted-foreground/40">{"★".repeat(5 - c.score_interno)}</span>
                      </span>
                    </td>
                    <td className="p-3">
                      <TagBadge tag={c.tag as Tag} />
                    </td>
                    <td className="p-3">
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NovoClienteDialog open={novoOpen} onOpenChange={setNovoOpen} />
    </div>
  );
}
