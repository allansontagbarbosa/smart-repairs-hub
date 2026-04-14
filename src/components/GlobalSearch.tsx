import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { ClipboardList, User, Zap } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewOS?: () => void;
  onNewClient?: () => void;
}

interface OSResult {
  id: string;
  numero: number;
  defeito_relatado: string;
  aparelhos: { marca: string; modelo: string; clientes: { nome: string } | null } | null;
}

interface ClientResult {
  id: string;
  nome: string;
  telefone: string;
}

export function GlobalSearch({ open, onOpenChange, onNewOS, onNewClient }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [ordens, setOrdens] = useState<OSResult[]>([]);
  const [clientes, setClientes] = useState<ClientResult[]>([]);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setOrdens([]);
      setClientes([]);
      return;
    }

    const isNumeric = /^\d+$/.test(q);

    const [osRes, cliRes] = await Promise.all([
      isNumeric
        ? supabase
            .from("ordens_de_servico")
            .select("id, numero, defeito_relatado, aparelhos(marca, modelo, clientes(nome))")
            .eq("numero", parseInt(q))
            .is("deleted_at", null)
            .limit(5)
        : supabase
            .from("ordens_de_servico")
            .select("id, numero, defeito_relatado, aparelhos(marca, modelo, clientes(nome))")
            .is("deleted_at", null)
            .limit(5),
      supabase
        .from("clientes")
        .select("id, nome, telefone")
        .is("deleted_at", null)
        .or(`nome.ilike.%${q}%,telefone.ilike.%${q}%`)
        .limit(5),
    ]);

    setOrdens((osRes.data as unknown as OSResult[]) || []);
    setClientes((cliRes.data as ClientResult[]) || []);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setOrdens([]);
      setClientes([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar no sistema..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {ordens.length > 0 && (
          <CommandGroup heading="Ordens de Serviço">
            {ordens.map((os) => (
              <CommandItem
                key={os.id}
                onSelect={() => {
                  onOpenChange(false);
                  navigate(`/assistencia?os=${os.id}`);
                }}
              >
                <ClipboardList className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>
                  OS #{String(os.numero).padStart(3, "0")} —{" "}
                  {os.aparelhos?.clientes?.nome || "—"} —{" "}
                  {os.aparelhos?.marca} {os.aparelhos?.modelo}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {clientes.length > 0 && (
          <CommandGroup heading="Clientes">
            {clientes.map((cli) => (
              <CommandItem
                key={cli.id}
                onSelect={() => {
                  onOpenChange(false);
                  navigate(`/clientes?id=${cli.id}`);
                }}
              >
                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>
                  {cli.nome} — {cli.telefone}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />
        <CommandGroup heading="Ações Rápidas">
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              onNewOS?.();
            }}
          >
            <Zap className="mr-2 h-4 w-4 text-muted-foreground" />
            Nova Ordem de Serviço
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              onNewClient?.();
            }}
          >
            <Zap className="mr-2 h-4 w-4 text-muted-foreground" />
            Novo Cliente
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
