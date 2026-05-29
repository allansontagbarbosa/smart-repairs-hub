import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, User, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { maskCPF } from "@/lib/utils";
import { NovoClienteDialog } from "./NovoClienteDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (cliente: any) => void;
}

export function ClienteSelectDialog({ open, onOpenChange, onSelect }: Props) {
  const { empresaId } = useEmpresa();
  const [busca, setBusca] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: clientes = [] } = useQuery({
    queryKey: ["loja-clientes-busca", empresaId, busca],
    queryFn: async () => {
      let q = (supabase as any)
        .from("loja_clientes")
        .select("id, nome, cpf, telefone, tag")
        .eq("empresa_id", empresaId)
        .is("deleted_at", null);
      if (busca) q = q.or(`nome.ilike.%${busca}%,cpf.ilike.%${busca}%,telefone.ilike.%${busca}%`);
      const { data } = await q.order("nome").limit(20);
      return data ?? [];
    },
    enabled: !!empresaId && open,
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar cliente</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Buscar por nome, CPF ou telefone..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-80 overflow-y-auto space-y-1">
            {clientes.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum cliente encontrado.
              </div>
            )}
            {clientes.map((c: any) => (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className="w-full text-left p-2.5 rounded-md hover:bg-muted transition-colors flex items-center gap-2"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.nome}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {c.cpf ? maskCPF(c.cpf) : "—"} · {c.telefone || "sem tel"}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              setNovoOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" /> Cadastrar novo cliente
          </Button>
        </DialogContent>
      </Dialog>

      <NovoClienteDialog open={novoOpen} onOpenChange={setNovoOpen} />
    </>
  );
}
