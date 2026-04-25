import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Search, ShieldAlert, Trash2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes } from "@/hooks/usePermissoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type OrdemCancelada = {
  id: string;
  numero: number | null;
  numero_formatado: string | null;
  status: string;
  data_entrada: string | null;
  cancelada_em: string | null;
  valor: number | null;
  aparelhos?: {
    marca: string | null;
    modelo: string | null;
    imei: string | null;
    clientes?: { nome: string | null; telefone: string | null } | null;
  } | null;
};

type PreviewExclusao = {
  can_delete: boolean;
  ordem: {
    id: string;
    numero: number | null;
    numero_formatado: string | null;
    status: string;
    data_entrada: string | null;
    cancelada_em: string | null;
    deleted_at: string | null;
    valor: number | null;
    cliente_nome: string | null;
    aparelho: string | null;
    imei: string | null;
  };
  dependencias: {
    historico_ordens: number;
    garantias: number;
    movimentacoes_financeiras: number;
    total_movimentacoes_financeiras: number;
  };
};

const CONFIRMACAO = "EXCLUIR DEFINITIVAMENTE";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatCurrency(value?: number | null) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ExclusaoOSCanceladas() {
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewExclusao | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const { isAdmin, loading } = usePermissoes();
  const queryClient = useQueryClient();

  const trimmedSearch = submittedSearch.trim();

  const { data: orders = [], isFetching } = useQuery({
    queryKey: ["os-canceladas-exclusao", trimmedSearch],
    enabled: isAdmin && trimmedSearch.length >= 2,
    queryFn: async () => {
      let aparelhoIds: string[] = [];
      if (!/^[0-9]+$/.test(trimmedSearch) && !/^[0-9a-f-]{32,36}$/i.test(trimmedSearch)) {
        const { data: aparelhosData, error: aparelhosError } = await supabase
          .from("aparelhos")
          .select("id")
          .ilike("imei", `%${trimmedSearch}%`)
          .limit(50);
        if (aparelhosError) throw aparelhosError;
        aparelhoIds = (aparelhosData ?? []).map((aparelho) => aparelho.id);
      }

      let query = supabase
        .from("ordens_de_servico")
        .select("id, numero, numero_formatado, status, data_entrada, cancelada_em, valor, aparelhos(marca, modelo, imei, clientes(nome, telefone))")
        .eq("status", "cancelado")
        .order("data_entrada", { ascending: false })
        .limit(12);

      if (/^[0-9]+$/.test(trimmedSearch)) {
        query = query.eq("numero", Number(trimmedSearch));
      } else if (/^[0-9a-f-]{32,36}$/i.test(trimmedSearch)) {
        query = query.eq("id", trimmedSearch);
      } else if (aparelhoIds.length > 0) {
        query = query.or(`numero_formatado.ilike.%${trimmedSearch}%,aparelho_id.in.(${aparelhoIds.join(",")})`);
      } else {
        query = query.ilike("numero_formatado", `%${trimmedSearch}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OrdemCancelada[];
    },
  });

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const previewMutation = useMutation({
    mutationFn: async (ordemId: string) => {
      const { data, error } = await (supabase as any).rpc("preview_exclusao_os_cancelada", { p_ordem_id: ordemId });
      if (error) throw error;
      return data as PreviewExclusao;
    },
    onSuccess: (data) => {
      setPreview(data);
      toast.success("Dependências validadas");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!preview?.ordem.id) throw new Error("Valide uma OS antes de excluir");
      const { data, error } = await (supabase as any).rpc("excluir_definitivamente_os_cancelada", {
        p_ordem_id: preview.ordem.id,
        p_confirmacao: confirmText,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("OS excluída definitivamente");
      setConfirmOpen(false);
      setConfirmText("");
      setPreview(null);
      setSelectedOrderId(null);
      queryClient.invalidateQueries({ queryKey: ["os-canceladas-exclusao"] });
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canDelete = !!preview?.can_delete && confirmText === CONFIRMACAO && !deleteMutation.isPending;

  const handleSearch = () => {
    setPreview(null);
    setSelectedOrderId(null);
    setSubmittedSearch(search);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>Somente administradores podem acessar a exclusão definitiva de OS canceladas.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h1 className="text-xl font-semibold">Exclusão definitiva de OS canceladas</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Valide histórico, garantias e movimentações financeiras antes de remover uma ordem cancelada do banco.
        </p>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Ação irreversível</AlertTitle>
        <AlertDescription>
          A exclusão definitiva remove a OS cancelada e as dependências mapeadas. Use apenas para correções administrativas.
        </AlertDescription>
      </Alert>

      <Card className="rounded-md shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Localizar OS cancelada</CardTitle>
          <CardDescription>Busque pelo número da OS, UUID, número formatado ou IMEI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                placeholder="Ex: 40, 2026-00040, UUID ou IMEI"
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={search.trim().length < 2 || isFetching}>
              {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Buscar
            </Button>
          </div>

          {trimmedSearch.length >= 2 && !isFetching && orders.length === 0 && (
            <div className="rounded-md border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma OS cancelada encontrada para a busca informada.
            </div>
          )}

          {orders.length > 0 && (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">OS</th>
                    <th className="px-3 py-2 font-medium">Cliente / aparelho</th>
                    <th className="px-3 py-2 font-medium">Entrada</th>
                    <th className="px-3 py-2 font-medium">Cancelada em</th>
                    <th className="px-3 py-2 text-right font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b last:border-b-0">
                      <td className="px-3 py-3 font-mono text-sm">
                        #{order.numero_formatado ?? String(order.numero ?? "—").padStart(3, "0")}
                        <Badge variant="secondary" className="ml-2">Cancelada</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{order.aparelhos?.clientes?.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {[order.aparelhos?.marca, order.aparelhos?.modelo].filter(Boolean).join(" ") || "Aparelho não informado"}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{formatDate(order.data_entrada)}</td>
                      <td className="px-3 py-3 text-muted-foreground">{formatDate(order.cancelada_em)}</td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          variant={selectedOrderId === order.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setSelectedOrderId(order.id);
                            setPreview(null);
                            previewMutation.mutate(order.id);
                          }}
                          disabled={previewMutation.isPending && selectedOrderId === order.id}
                        >
                          {previewMutation.isPending && selectedOrderId === order.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                          Validar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Card className="rounded-md border-destructive/30 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-success" /> Validação concluída
            </CardTitle>
            <CardDescription>
              OS #{preview.ordem.numero_formatado ?? preview.ordem.numero} — {preview.ordem.cliente_nome ?? selectedOrder?.aparelhos?.clientes?.nome ?? "Cliente não informado"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <DependencyBox label="Histórico" value={preview.dependencias.historico_ordens} />
              <DependencyBox label="Garantias" value={preview.dependencias.garantias} />
              <DependencyBox label="Mov. financeiras" value={preview.dependencias.movimentacoes_financeiras} />
              <DependencyBox label="Total financeiro" value={formatCurrency(preview.dependencias.total_movimentacoes_financeiras)} />
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
              <div className="grid gap-2 md:grid-cols-2">
                <InfoRow label="Aparelho" value={preview.ordem.aparelho || "—"} />
                <InfoRow label="IMEI" value={preview.ordem.imei || "—"} />
                <InfoRow label="Entrada" value={formatDate(preview.ordem.data_entrada)} />
                <InfoRow label="Cancelada em" value={formatDate(preview.ordem.cancelada_em)} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir definitivamente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão definitiva</DialogTitle>
            <DialogDescription>
              Esta ação removerá permanentemente a OS cancelada e suas dependências mapeadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Não será possível desfazer</AlertTitle>
              <AlertDescription>Digite exatamente {CONFIRMACAO} para liberar a ação.</AlertDescription>
            </Alert>
            <Input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder={CONFIRMACAO} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleteMutation.isPending}>Cancelar</Button>
            <Button variant="destructive" disabled={!canDelete} onClick={() => deleteMutation.mutate()}>
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Excluir definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DependencyBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}