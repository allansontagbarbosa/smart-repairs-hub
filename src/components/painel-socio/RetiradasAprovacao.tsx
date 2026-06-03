import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, X, Loader2, ShieldAlert } from "lucide-react";
import {
  useRetiradasFluxo,
  useAprovarRetirada,
  useRejeitarRetirada,
  useCancelarRetirada,
  type RetiradaFluxoStatus,
} from "@/hooks/useRetiradasFluxo";

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
const fmtDt = (iso: string) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const statusBadge: Record<RetiradaFluxoStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "outline" },
  aprovada: { label: "Aprovada", variant: "default" },
  efetivada: { label: "Aprovada", variant: "default" },
  rejeitada: { label: "Rejeitada", variant: "destructive" },
  cancelada: { label: "Cancelada", variant: "secondary" },
};

export function RetiradasAprovacao() {
  const { data: retiradas = [], isLoading } = useRetiradasFluxo();
  const aprovar = useAprovarRetirada();
  const rejeitar = useRejeitarRetirada();
  const cancelar = useCancelarRetirada();

  const [rejId, setRejId] = useState<string | null>(null);
  const [rejMotivo, setRejMotivo] = useState("");
  const [cancId, setCancId] = useState<string | null>(null);

  const handleAprovar = (id: string) => {
    aprovar.mutate(id, {
      onSuccess: () => toast.success("Retirada aprovada e efetivada."),
      onError: (e: any) => toast.error(e?.message || "Erro ao aprovar"),
    });
  };

  const handleRejeitar = () => {
    if (!rejId) return;
    rejeitar.mutate(
      { id: rejId, motivo: rejMotivo || undefined },
      {
        onSuccess: () => {
          toast.success("Retirada rejeitada.");
          setRejId(null);
          setRejMotivo("");
        },
        onError: (e: any) => toast.error(e?.message || "Erro ao rejeitar"),
      },
    );
  };

  const handleCancelar = () => {
    if (!cancId) return;
    cancelar.mutate(
      { id: cancId },
      {
        onSuccess: () => {
          toast.success("Retirada cancelada.");
          setCancId(null);
        },
        onError: (e: any) => toast.error(e?.message || "Erro ao cancelar"),
      },
    );
  };

  const pendentes = retiradas.filter((r) => r.status === "pendente");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          Retiradas com aprovação
          {pendentes.length > 0 && (
            <Badge variant="outline" className="ml-1">
              {pendentes.length} pendente{pendentes.length > 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : retiradas.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma retirada registrada.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sócio</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Solicitada em</TableHead>
                <TableHead>Aprovada/decidida em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {retiradas.map((r) => {
                const sb = statusBadge[r.status] ?? statusBadge.pendente;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.socio_nome}</div>
                      {r.descricao && (
                        <div className="text-xs text-muted-foreground line-clamp-1">{r.descricao}</div>
                      )}
                      {r.status === "rejeitada" && r.motivo_rejeicao && (
                        <div className="text-xs text-destructive mt-1">Motivo: {r.motivo_rejeicao}</div>
                      )}
                      {r.status === "cancelada" && r.motivo_cancelamento && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Motivo: {r.motivo_cancelamento}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums">{brl(r.valor)}</TableCell>
                    <TableCell>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDt(r.criado_em)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.aprovado_em ? fmtDt(r.aprovado_em) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.pode_aprovar && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleAprovar(r.id)}
                              disabled={aprovar.isPending}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRejId(r.id)}
                              disabled={rejeitar.isPending}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitar
                            </Button>
                          </>
                        )}
                        {r.pode_cancelar && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCancId(r.id)}
                            disabled={cancelar.isPending}
                          >
                            <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog open={!!rejId} onOpenChange={(v) => !v && setRejId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar retirada</AlertDialogTitle>
            <AlertDialogDescription>
              Informe um motivo (opcional). Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={rejMotivo}
            onChange={(e) => setRejMotivo(e.target.value)}
            placeholder="Motivo da rejeição…"
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRejeitar} disabled={rejeitar.isPending}>
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancId} onOpenChange={(v) => !v && setCancId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              A retirada pendente será cancelada e não poderá mais ser aprovada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelar} disabled={cancelar.isPending}>
              Cancelar retirada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
