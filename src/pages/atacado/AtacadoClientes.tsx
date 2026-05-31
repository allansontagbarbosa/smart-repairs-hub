import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Users, Plus, Search, AlertCircle, Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBRL, maskCNPJ } from "@/lib/utils";
import { NovoClienteAtacadoDialog } from "@/components/atacado/NovoClienteAtacadoDialog";
import { ClienteAtacadoDrawer } from "@/components/atacado/ClienteAtacadoDrawer";
import { AtacadoEmptyState } from "@/components/atacado/AtacadoEmptyState";

export default function AtacadoClientes() {
  const { empresaId } = useEmpresa();
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [novoOpen, setNovoOpen] = useState(false);
  const [drawerClienteId, setDrawerClienteId] = useState<string | null>(null);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["atacado-clientes", empresaId, busca, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("atacado_clientes" as any)
        .select(
          `id, razao_social, nome_fantasia, cnpj, telefone, email, limite_credito, prazo_pagamento_padrao, status, score, created_at,
           tabela_preco:atacado_tabelas_preco(nome),
           vendedor:funcionarios(nome)`
        )
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null);

      if (statusFilter !== "todos") q = q.eq("status", statusFilter);
      if (busca) {
        const safe = busca.replace(/[%,()]/g, "");
        q = q.or(
          `razao_social.ilike.%${safe}%,nome_fantasia.ilike.%${safe}%,cnpj.ilike.%${safe}%`
        );
      }
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    enabled: !!empresaId,
  });

  const totalCadastrados = clientes.length;
  const ativos = clientes.filter((c: any) => c.status === "ativo").length;
  const inadimplentes = clientes.filter((c: any) => c.status === "inadimplente").length;
  const bloqueados = clientes.filter((c: any) => c.status === "bloqueado").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes B2B</h1>
          <p className="text-sm text-muted-foreground">
            Lojistas, revendedores e parceiros
          </p>
        </div>
        <Button size="sm" onClick={() => setNovoOpen(true)}>
          <Plus className="h-4 w-4" /> Novo cliente
        </Button>
      </div>

      {/* Filtros + busca */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por razão social, fantasia ou CNPJ…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="bloqueado">Bloqueados</SelectItem>
            <SelectItem value="inadimplente">Inadimplentes</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Resumo */}
      {totalCadastrados > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">{ativos}</strong> ativos
          </span>
          {inadimplentes > 0 && (
            <span className="text-warning">
              <strong>{inadimplentes}</strong> inadimplentes
            </span>
          )}
          {bloqueados > 0 && (
            <span className="text-destructive">
              <strong>{bloqueados}</strong> bloqueados
            </span>
          )}
        </div>
      )}

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : totalCadastrados === 0 ? (
        <AtacadoEmptyState
          icon={Users}
          title={busca || statusFilter !== "todos" ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          description="Cadastre lojistas e revendedores para começar a vender no atacado."
          actionLabel="Novo cliente"
          onAction={() => setNovoOpen(true)}
        />
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Cliente</th>
                <th className="text-left px-4 py-3 font-medium">CNPJ</th>
                <th className="text-left px-4 py-3 font-medium">Tabela</th>
                <th className="text-right px-4 py-3 font-medium">Limite</th>
                <th className="text-right px-4 py-3 font-medium">Prazo</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c: any) => (
                <tr
                  key={c.id}
                  onClick={() => setDrawerClienteId(c.id)}
                  className="cursor-pointer hover:bg-muted/40 border-b transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">
                      {c.nome_fantasia || c.razao_social}
                    </p>
                    {c.nome_fantasia && (
                      <p className="text-xs text-muted-foreground">{c.razao_social}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {c.cnpj ? maskCNPJ(c.cnpj) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {c.tabela_preco?.nome ? (
                      <Badge variant="outline">{c.tabela_preco.nome}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">sem tabela</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {Number(c.limite_credito) > 0 ? (
                      formatBRL(Number(c.limite_credito))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {c.prazo_pagamento_padrao > 0 ? `${c.prazo_pagamento_padrao}d` : "À vista"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NovoClienteAtacadoDialog open={novoOpen} onOpenChange={setNovoOpen} />
      <ClienteAtacadoDrawer
        open={!!drawerClienteId}
        onOpenChange={(v) => !v && setDrawerClienteId(null)}
        clienteId={drawerClienteId}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon?: any }> = {
    ativo: { label: "Ativo", cls: "bg-success/15 text-success border-success/30" },
    bloqueado: {
      label: "Bloqueado",
      cls: "bg-destructive/15 text-destructive border-destructive/30",
      icon: Ban,
    },
    inadimplente: {
      label: "Inadimplente",
      cls: "bg-warning/15 text-warning border-warning/30",
      icon: AlertCircle,
    },
    inativo: { label: "Inativo", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status] ?? map.inativo;
  const Icon = m.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${m.cls}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {m.label}
    </Badge>
  );
}
