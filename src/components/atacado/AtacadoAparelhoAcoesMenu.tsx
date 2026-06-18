import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";
import { usePermissoesAtacado } from "@/hooks/usePermissoesAtacado";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Eye,
  Tag,
  Printer,
  Trash2,
  CheckCircle2,
  ShoppingCart,
} from "lucide-react";
import { printEtiquetaAtacado } from "@/lib/printEtiquetaAtacado";

interface Props {
  aparelho: any;
  statusCatalogo: Array<{ nome: string; categoria: string | null }>;
  onVerDetalhes: () => void;
}

export function AtacadoAparelhoAcoesMenu({
  aparelho,
  statusCatalogo,
  onVerDetalhes,
}: Props) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const perms = usePermissoesAtacado();
  const [confirmDel, setConfirmDel] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });
    qc.invalidateQueries({ queryKey: ["atacado-aparelho-detalhe"] });
  };

  const mudarStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("atacado_aparelhos" as any)
        .update({ status })
        .eq("id", aparelho.id)
        .eq("empresa_id", empresaId!);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "✓ Status atualizado" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      // Checa histórico antes
      const { count } = await supabase
        .from("atacado_pedidos_itens" as any)
        .select("id", { count: "exact", head: true })
        .eq("aparelho_id", aparelho.id);
      const semHistorico = (count ?? 0) === 0;
      const { error } = await supabase
        .from("atacado_aparelhos" as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", aparelho.id)
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return { semHistorico };
    },
    onSuccess: ({ semHistorico }) => {
      invalidate();
      toast({
        title: semHistorico
          ? "✓ Aparelho excluído"
          : "✓ Aparelho desativado (com histórico)",
      });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const onImprimir = () =>
    printEtiquetaAtacado({
      modelo: aparelho.modelo,
      capacidade: aparelho.capacidade,
      cor: aparelho.cor,
      imei: aparelho.imei_1,
      preco: Number(aparelho.preco_sugerido ?? 0),
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={onVerDetalhes}>
            <Eye className="h-4 w-4 mr-2" /> Ver detalhes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onImprimir}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir etiqueta
          </DropdownMenuItem>

          {perms.podeEditarEstoque && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Tag className="h-4 w-4 mr-2" /> Mudar status
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuLabel className="text-xs">
                    Status atual: {aparelho.status}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {statusCatalogo.map((s) => (
                    <DropdownMenuItem
                      key={s.nome}
                      disabled={s.nome === aparelho.status || mudarStatus.isPending}
                      onClick={() => mudarStatus.mutate(s.nome)}
                    >
                      {s.categoria === "reservado" && (
                        <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-warning" />
                      )}
                      {s.categoria === "vendido" && (
                        <ShoppingCart className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                      )}
                      {s.nome}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirmDel(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Remover do estoque
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover aparelho do estoque?</AlertDialogTitle>
            <AlertDialogDescription>
              Se o aparelho já tem histórico (pedido/venda), ele será apenas
              desativado. Caso contrário, será arquivado (soft delete).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => excluir.mutate()}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
