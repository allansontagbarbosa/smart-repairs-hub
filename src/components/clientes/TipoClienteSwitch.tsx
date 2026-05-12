import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Store, User, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  clienteId: string;
  tipoAtual: "lojista_b2b" | "consumidor_b2c";
  compact?: boolean;
}

export function TipoClienteSwitch({ clienteId, tipoAtual, compact = false }: Props) {
  const qc = useQueryClient();
  const isLojista = tipoAtual === "lojista_b2b";

  const alterar = useMutation({
    mutationFn: async (novoTipo: "lojista_b2b" | "consumidor_b2c") => {
      const { data, error } = await (supabase as any).rpc("alterar_tipo_cliente", {
        p_cliente_id: clienteId,
        p_novo_tipo: novoTipo,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro");
      return data;
    },
    onSuccess: (data) => {
      if (!data.no_op) {
        toast.success(
          data.tipo_novo === "lojista_b2b"
            ? "Marcado como lojista B2B"
            : "Marcado como consumidor final",
        );
      }
      qc.invalidateQueries({ queryKey: ["clientes-saldos"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["cliente", clienteId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (compact) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={isLojista ? "default" : "secondary"}
              className="gap-1 text-[10px] px-1.5 py-0"
            >
              {isLojista ? <Store className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
              {isLojista ? "B2B" : "B2C"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isLojista ? "Lojista (preço B2B)" : "Consumidor final (preço B2C)"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-card p-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {isLojista ? (
            <Store className="h-4 w-4 text-primary" />
          ) : (
            <User className="h-4 w-4 text-muted-foreground" />
          )}
          <p className="font-medium">{isLojista ? "Lojista B2B" : "Consumidor final B2C"}</p>
          {alterar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {isLojista
            ? "Usa preços B2B (atacado). Pode ter acesso ao portal do lojista."
            : "Usa preços B2C (varejo). Sem acesso ao portal."}
        </p>
      </div>
      <Switch
        checked={isLojista}
        disabled={alterar.isPending}
        onCheckedChange={(checked) => alterar.mutate(checked ? "lojista_b2b" : "consumidor_b2c")}
      />
    </div>
  );
}
