import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MoreHorizontal,
  Eye,
  Tag,
  Printer,
  Trash2,
  Pencil,
  Bookmark,
  ShoppingCart,
  ArrowLeftRight,
  PackageMinus,
  Loader2,
  Copy,
} from "lucide-react";
import { printEtiquetaAtacado } from "@/lib/printEtiquetaAtacado";
import { garantirStatusCategoria } from "@/lib/atacadoStatus";
import { statusLabel } from "./AtacadoStatusBadge";

interface Props {
  aparelho: any;
  statusCatalogo: Array<{ nome: string; categoria: string | null }>;
  onVerDetalhes: () => void;
}

type DialogKind = null | "editar" | "reservar" | "baixar" | "mover";

export function AtacadoAparelhoAcoesMenu({
  aparelho,
  statusCatalogo,
  onVerDetalhes,
}: Props) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const perms = usePermissoesAtacado();
  const navigate = useNavigate();
  const [open, setOpen] = useState<DialogKind>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });
    qc.invalidateQueries({ queryKey: ["atacado-aparelho-detalhe"] });
    qc.invalidateQueries({ queryKey: ["atacado-status-catalogo"] });
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

  const onVender = () =>
    navigate(`/atacado/novo-pedido?aparelho=${aparelho.id}`);

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

          {perms.podeEditarEstoque && (
            <DropdownMenuItem onClick={() => setOpen("editar")}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
          )}

          {perms.podeEditarEstoque && (
            <DropdownMenuItem
              onClick={() =>
                navigate(`/atacado/aparelhos/novo?duplicar=${aparelho.id}`)
              }
            >
              <Copy className="h-4 w-4 mr-2" /> Duplicar
            </DropdownMenuItem>
          )}

          {perms.podeEditarEstoque && statusCatalogo.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Tag className="h-4 w-4 mr-2" /> Mudar status
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuLabel className="text-xs">
                  Atual: {statusLabel(aparelho.status, statusCatalogo)}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {statusCatalogo.map((s) => (
                  <DropdownMenuItem
                    key={s.nome}
                    disabled={s.nome === aparelho.status || mudarStatus.isPending}
                    onClick={() => mudarStatus.mutate(s.nome)}
                  >
                    {statusLabel(s.nome, statusCatalogo)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {perms.podeEditarEstoque && (
            <DropdownMenuItem onClick={() => setOpen("reservar")}>
              <Bookmark className="h-4 w-4 mr-2" /> Reservar
            </DropdownMenuItem>
          )}

          {perms.podeCriarPedido && (
            <DropdownMenuItem onClick={onVender}>
              <ShoppingCart className="h-4 w-4 mr-2" /> Vender / dar baixa
            </DropdownMenuItem>
          )}

          {perms.podeEditarEstoque && (
            <DropdownMenuItem onClick={() => setOpen("baixar")}>
              <PackageMinus className="h-4 w-4 mr-2" /> Baixa manual
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={onImprimir}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir etiqueta
          </DropdownMenuItem>

          {perms.podeEditarEstoque && (
            <DropdownMenuItem onClick={() => setOpen("mover")}>
              <ArrowLeftRight className="h-4 w-4 mr-2" /> Mover do estoque
            </DropdownMenuItem>
          )}

          {perms.podeEditarEstoque && (
            <>
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

      <EditarAparelhoDialog
        open={open === "editar"}
        onClose={() => setOpen(null)}
        aparelho={aparelho}
      />
      <ReservarAparelhoDialog
        open={open === "reservar"}
        onClose={() => setOpen(null)}
        aparelho={aparelho}
      />
      <BaixaManualDialog
        open={open === "baixar"}
        onClose={() => setOpen(null)}
        aparelho={aparelho}
      />
      <MoverParaLojaDialog
        open={open === "mover"}
        onClose={() => setOpen(null)}
        aparelho={aparelho}
      />

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover aparelho do estoque?</AlertDialogTitle>
            <AlertDialogDescription>
              Se já tem histórico (pedido/venda), é apenas desativado. Caso
              contrário, será arquivado (soft delete).
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

/* ===================== EDITAR ===================== */
function EditarAparelhoDialog({
  open,
  onClose,
  aparelho,
}: {
  open: boolean;
  onClose: () => void;
  aparelho: any;
}) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const perms = usePermissoesAtacado();
  const podeEditarCusto = perms.podeConfigurar; // custo só com permissão de configuração
  const [form, setForm] = useState({
    modelo: aparelho.modelo ?? "",
    capacidade: aparelho.capacidade ?? "",
    cor: aparelho.cor ?? "",
    grade: aparelho.grade ?? "",
    condicao: aparelho.condicao ?? "novo",
    preco_sugerido: aparelho.preco_sugerido ?? "",
    custo: aparelho.custo ?? "",
    observacoes: aparelho.observacoes ?? "",
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const payload: any = {
        modelo: form.modelo,
        capacidade: form.capacidade || null,
        cor: form.cor || null,
        grade: form.grade || null,
        condicao: form.condicao,
        preco_sugerido: form.preco_sugerido ? Number(form.preco_sugerido) : null,
        observacoes: form.observacoes || null,
      };
      if (podeEditarCusto) payload.custo = Number(form.custo);
      const { error } = await supabase
        .from("atacado_aparelhos" as any)
        .update(payload)
        .eq("id", aparelho.id)
        .eq("empresa_id", empresaId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });
      qc.invalidateQueries({ queryKey: ["atacado-aparelho-detalhe"] });
      toast({ title: "✓ Aparelho atualizado" });
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Editar aparelho</DialogTitle>
          <DialogDescription>
            Altere informações do aparelho. Custo só com permissão de configuração.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-2">
            <Label className="text-xs">Modelo</Label>
            <Input
              value={form.modelo}
              onChange={(e) => setForm({ ...form, modelo: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Capacidade</Label>
            <Input
              value={form.capacidade}
              onChange={(e) => setForm({ ...form, capacidade: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Cor</Label>
            <Input
              value={form.cor}
              onChange={(e) => setForm({ ...form, cor: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Grade</Label>
            <Input
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Condição</Label>
            <Select
              value={form.condicao}
              onValueChange={(v) => setForm({ ...form, condicao: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="seminovo_a">Seminovo A</SelectItem>
                <SelectItem value="seminovo_b">Seminovo B</SelectItem>
                <SelectItem value="seminovo_c">Seminovo C</SelectItem>
                <SelectItem value="sucata">Sucata</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Preço sugerido (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.preco_sugerido}
              onChange={(e) =>
                setForm({ ...form, preco_sugerido: e.target.value })
              }
            />
          </div>
          <div>
            <Label className="text-xs">
              Custo (R$){" "}
              {!podeEditarCusto && (
                <span className="text-muted-foreground">— bloqueado</span>
              )}
            </Label>
            <Input
              type="number"
              step="0.01"
              value={form.custo}
              disabled={!podeEditarCusto}
              onChange={(e) => setForm({ ...form, custo: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) =>
                setForm({ ...form, observacoes: e.target.value })
              }
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || !form.modelo}
          >
            {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===================== RESERVAR ===================== */
function ReservarAparelhoDialog({
  open,
  onClose,
  aparelho,
}: {
  open: boolean;
  onClose: () => void;
  aparelho: any;
}) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [nota, setNota] = useState("");

  const reservar = useMutation({
    mutationFn: async () => {
      const nome = await garantirStatusCategoria(
        empresaId!,
        "reservado",
        "RESERVADO",
      );
      const obsAtual = aparelho.observacoes ?? "";
      const novaObs = nota
        ? `${obsAtual}${obsAtual ? "\n" : ""}[reserva] ${nota}`
        : obsAtual;
      const { error } = await supabase
        .from("atacado_aparelhos" as any)
        .update({ status: nome, observacoes: novaObs })
        .eq("id", aparelho.id)
        .eq("empresa_id", empresaId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });
      qc.invalidateQueries({ queryKey: ["atacado-status-catalogo"] });
      qc.invalidateQueries({ queryKey: ["atacado-aparelho-detalhe"] });
      toast({ title: "✓ Aparelho reservado" });
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Reservar aparelho</DialogTitle>
          <DialogDescription>
            Move o aparelho para o status de reserva (sai do "Em estoque").
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-xs">Nota da reserva (opcional)</Label>
          <Textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ex.: reservado para cliente João até sexta"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => reservar.mutate()} disabled={reservar.isPending}>
            {reservar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Reservar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===================== BAIXA MANUAL ===================== */
function BaixaManualDialog({
  open,
  onClose,
  aparelho,
}: {
  open: boolean;
  onClose: () => void;
  aparelho: any;
}) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState<string>("perda");
  const [detalhe, setDetalhe] = useState("");

  const baixar = useMutation({
    mutationFn: async () => {
      if (!detalhe.trim()) throw new Error("Descreva o motivo da baixa.");
      const nome = await garantirStatusCategoria(
        empresaId!,
        "vendido",
        "BAIXADO",
      );
      const obsAtual = aparelho.observacoes ?? "";
      const tag = `[baixa:${motivo}] ${detalhe}`;
      const novaObs = `${obsAtual}${obsAtual ? "\n" : ""}${tag}`;
      const { error } = await supabase
        .from("atacado_aparelhos" as any)
        .update({
          status: nome,
          observacoes: novaObs,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", aparelho.id)
        .eq("empresa_id", empresaId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });
      qc.invalidateQueries({ queryKey: ["atacado-status-catalogo"] });
      toast({ title: "✓ Baixa registrada" });
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Baixa manual do estoque</DialogTitle>
          <DialogDescription>
            Para venda use "Vender / dar baixa". Esta opção é para perda,
            defeito ou uso interno — não mexe em financeiro.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div>
            <Label className="text-xs">Motivo</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="perda">Perda / extravio</SelectItem>
                <SelectItem value="defeito">Defeito / inutilizável</SelectItem>
                <SelectItem value="uso_interno">Uso interno / demo</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Detalhe (obrigatório)</Label>
            <Textarea
              value={detalhe}
              onChange={(e) => setDetalhe(e.target.value)}
              rows={3}
              placeholder="Descreva o que aconteceu"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => baixar.mutate()}
            disabled={baixar.isPending || !detalhe.trim()}
          >
            {baixar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Dar baixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===================== MOVER PARA LOJA ===================== */
function MoverParaLojaDialog({
  open,
  onClose,
  aparelho,
}: {
  open: boolean;
  onClose: () => void;
  aparelho: any;
}) {
  const { empresaId } = useEmpresa();
  const { toast } = useToast();
  const qc = useQueryClient();

  const mover = useMutation({
    mutationFn: async () => {
      // 1. Cria aparelho na Loja (origem='transferencia'), reusando dados
      const { data: novoLoja, error: errLoja } = await supabase
        .from("loja_aparelhos" as any)
        .insert({
          empresa_id: empresaId,
          modelo: aparelho.modelo,
          capacidade: aparelho.capacidade ?? null,
          cor: aparelho.cor ?? null,
          imei_1: aparelho.imei_1 ?? null,
          imei_2: aparelho.imei_2 ?? null,
          condicao: aparelho.condicao ?? "novo",
          custo: aparelho.custo,
          preco_venda: aparelho.preco_sugerido ?? aparelho.custo,
          status: "estoque",
          origem: "transferencia",
          fornecedor_id: aparelho.fornecedor_id ?? null,
          observacoes: `Transferido do Atacado em ${new Date().toLocaleDateString("pt-BR")}`,
        } as any)
        .select("id")
        .single();
      if (errLoja) throw errLoja;

      // 2. Soft-delete do registro no Atacado + vincular loja_aparelho_id
      const nome = await garantirStatusCategoria(
        empresaId!,
        "vendido",
        "TRANSFERIDO",
      );
      const { error: errAt } = await supabase
        .from("atacado_aparelhos" as any)
        .update({
          loja_aparelho_id: (novoLoja as any).id,
          status: nome,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", aparelho.id)
        .eq("empresa_id", empresaId!);
      if (errAt) throw errAt;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atacado-aparelhos"] });
      qc.invalidateQueries({ queryKey: ["loja-aparelhos-via-atacado"] });
      toast({ title: "✓ Aparelho movido para a Loja" });
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Mover para a Loja?</DialogTitle>
          <DialogDescription>
            O aparelho será criado no Estoque da Loja (origem: transferência) e
            removido do Atacado. O vínculo é mantido para histórico.
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm text-muted-foreground bg-muted/40 rounded-md p-3">
          <p className="font-medium text-foreground">
            {aparelho.modelo} {aparelho.capacidade ?? ""} {aparelho.cor ?? ""}
          </p>
          {aparelho.imei_1 && (
            <p className="font-mono text-xs mt-1">IMEI {aparelho.imei_1}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mover.mutate()} disabled={mover.isPending}>
            {mover.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Mover para a Loja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
