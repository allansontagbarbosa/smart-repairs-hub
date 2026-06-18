import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useToast } from "@/hooks/use-toast";
import { usePermissoesAtacado } from "@/hooks/usePermissoesAtacado";
import { formatBRL } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
import { Loader2, Trash2 } from "lucide-react";
import { AtacadoStatusBadge } from "./AtacadoStatusBadge";

interface Props {
  aparelhoId: string | null;
  onOpenChange: (v: boolean) => void;
  statusCatalogo: Array<{ nome: string; categoria: string | null }>;
}

export function AtacadoAparelhoDetalheSheet({
  aparelhoId,
  onOpenChange,
  statusCatalogo,
}: Props) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const perms = usePermissoesAtacado();
  const [novoStatus, setNovoStatus] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: aparelho, isLoading } = useQuery({
    queryKey: ["atacado-aparelho-detalhe", aparelhoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atacado_aparelhos" as any)
        .select("*, fornecedor:fornecedores(nome)")
        .eq("id", aparelhoId!)
        .eq("empresa_id", empresaId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!aparelhoId && !!empresaId,
  });

  useEffect(() => {
    if (aparelho?.status) setNovoStatus(aparelho.status);
  }, [aparelho?.status]);

  const mudarStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("atacado_aparelhos" as any)
        .update({ status })
        .eq("id", aparelhoId!)
        .eq("empresa_id", empresaId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });
      qc.invalidateQueries({ queryKey: ["atacado-aparelho-detalhe", aparelhoId] });
      toast({ title: "✓ Status atualizado" });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("atacado_aparelhos" as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", aparelhoId!)
        .eq("empresa_id", empresaId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });
      toast({ title: "✓ Aparelho removido do estoque" });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const diasParado = aparelho?.data_entrada
    ? Math.floor((Date.now() - new Date(aparelho.data_entrada).getTime()) / 86400000)
    : 0;
  const custoNum = Number(aparelho?.custo ?? 0);
  const precoNum = Number(aparelho?.preco_sugerido ?? 0);
  const markup = custoNum > 0 && precoNum > 0 ? ((precoNum - custoNum) / custoNum) * 100 : 0;
  const margem = precoNum > 0 ? ((precoNum - custoNum) / precoNum) * 100 : 0;

  return (
    <>
      <Sheet open={!!aparelhoId} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalhes do aparelho</SheetTitle>
            <SheetDescription>
              Visualizar, alterar status ou remover do estoque.
            </SheetDescription>
          </SheetHeader>

          {isLoading || !aparelho ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5 mt-4">
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {aparelho.modelo} {aparelho.capacidade ?? ""} {aparelho.cor ?? ""}
                </p>
                <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  {aparelho.marca && <span>{aparelho.marca}</span>}
                  {aparelho.grade && <span>· Grade {aparelho.grade}</span>}
                  {aparelho.condicao && <span>· {aparelho.condicao}</span>}
                </div>
                <div className="mt-2">
                  <AtacadoStatusBadge
                    status={aparelho.status}
                    catalogo={statusCatalogo}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="IMEI 1" value={aparelho.imei_1 ?? "—"} mono />
                <Info label="IMEI 2" value={aparelho.imei_2 ?? "—"} mono />
                <Info label="Quantidade" value={String(aparelho.quantidade ?? 0)} />
                <Info
                  label="Dias em estoque"
                  value={aparelho.data_entrada ? `${diasParado}d` : "—"}
                />
                <Info label="Custo unit." value={formatBRL(custoNum)} />
                <Info
                  label="Preço sugerido"
                  value={precoNum ? formatBRL(precoNum) : "—"}
                />
                <Info
                  label="Markup"
                  value={markup > 0 ? `${markup.toFixed(1)}%` : "—"}
                />
                <Info
                  label="Margem"
                  value={margem > 0 ? `${margem.toFixed(1)}%` : "—"}
                />
                <Info
                  label="Fornecedor"
                  value={aparelho.fornecedor?.nome ?? "—"}
                />
                <Info
                  label="Entrada"
                  value={
                    aparelho.data_entrada
                      ? new Date(aparelho.data_entrada).toLocaleDateString("pt-BR")
                      : "—"
                  }
                />
              </div>

              {aparelho.observacoes && (
                <div>
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                    {aparelho.observacoes}
                  </p>
                </div>
              )}

              {perms.podeEditarEstoque && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Mudar status
                    </p>
                    <div className="flex gap-2">
                      <Select value={novoStatus} onValueChange={setNovoStatus}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione…" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusCatalogo.map((s) => (
                            <SelectItem key={s.nome} value={s.nome}>
                              {s.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        disabled={
                          mudarStatus.isPending ||
                          !novoStatus ||
                          novoStatus === aparelho.status
                        }
                        onClick={() => mudarStatus.mutate(novoStatus)}
                      >
                        {mudarStatus.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Aplicar"
                        )}
                      </Button>
                    </div>
                  </div>

                  <Separator />
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-4 w-4" /> Remover do estoque
                  </Button>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover aparelho do estoque?</AlertDialogTitle>
            <AlertDialogDescription>
              O aparelho será arquivado (soft delete). Esta ação pode ser
              revertida pelo suporte. Histórico é mantido.
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

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}
