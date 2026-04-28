import { useMemo, useState } from "react";
import { Loader2, ReceiptText, Search, WalletCards } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const db = supabase as any;

type Lojista = {
  id: string;
  nome: string;
};

type FaturaStatus = "aberta" | "fechada" | "paga" | "cancelada";

type FaturaLojista = {
  id: string;
  lojista_id: string;
  empresa_id: string;
  mes_competencia: string;
  status: FaturaStatus;
  total_servicos: number;
  total_pecas: number;
  total_geral: number;
  data_emissao: string | null;
  data_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
  lojistas?: Lojista | null;
};

type OrdemFaturada = {
  id: string;
  numero: number;
  numero_formatado: string | null;
  valor_total: number | null;
  valor_total_servicos: number | null;
  custo_pecas: number | null;
  data_conclusao: string | null;
  data_entrega: string | null;
  aparelhos?: {
    marca: string | null;
    modelo: string | null;
    imei: string | null;
    clientes?: { nome: string | null } | null;
  } | null;
};

const statusLabels: Record<FaturaStatus, string> = {
  aberta: "Aberta",
  fechada: "Fechada",
  paga: "Paga",
  cancelada: "Cancelada",
};

function money(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthOptions() {
  const base = new Date();
  return Array.from({ length: 13 }, (_, index) => {
    const d = new Date(base.getFullYear(), base.getMonth() - index, 1);
    const value = d.toISOString().slice(0, 7);
    return { value, label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  });
}

async function fetchLojistas() {
  const { data, error } = await db
    .from("lojistas")
    .select("id, nome")
    .is("deleted_at", null)
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Lojista[];
}

async function fetchFaturas() {
  const { data, error } = await db
    .from("lojista_faturas")
    .select("*, lojistas ( id, nome )")
    .order("mes_competencia", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FaturaLojista[];
}

async function fetchOrdensFatura(faturaId: string | null) {
  if (!faturaId) return [];
  const { data, error } = await db
    .from("ordens_de_servico")
    .select("id, numero, numero_formatado, valor_total, valor_total_servicos, custo_pecas, data_conclusao, data_entrega, aparelhos ( marca, modelo, imei, clientes ( nome ) )")
    .eq("fatura_id", faturaId)
    .is("deleted_at", null)
    .order("data_conclusao", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OrdemFaturada[];
}

export default function FaturasLojistas() {
  const queryClient = useQueryClient();
  const [lojistaFiltro, setLojistaFiltro] = useState("todos");
  const [mesFiltro, setMesFiltro] = useState(currentMonth());
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [gerarLojistaId, setGerarLojistaId] = useState("");
  const [gerarMes, setGerarMes] = useState(currentMonth());
  const [selectedFatura, setSelectedFatura] = useState<FaturaLojista | null>(null);

  const { data: lojistas = [], isLoading: loadingLojistas } = useQuery({
    queryKey: ["lojistas-faturas"],
    queryFn: fetchLojistas,
  });

  const { data: faturas = [], isLoading: loadingFaturas } = useQuery({
    queryKey: ["lojista-faturas"],
    queryFn: fetchFaturas,
  });

  const { data: ordensFatura = [], isLoading: loadingOrdens } = useQuery({
    queryKey: ["ordens-fatura", selectedFatura?.id],
    queryFn: () => fetchOrdensFatura(selectedFatura?.id ?? null),
    enabled: !!selectedFatura?.id,
  });

  const gerarFatura = useMutation({
    mutationFn: async () => {
      if (!gerarLojistaId) throw new Error("Selecione um lojista");
      const { data, error } = await db.rpc("gerar_ou_atualizar_fatura_lojista", {
        p_lojista_id: gerarLojistaId,
        p_mes: gerarMes,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Fatura B2B gerada/atualizada");
      queryClient.invalidateQueries({ queryKey: ["lojista-faturas"] });
    },
    onError: (error: any) => toast.error(error.message || "Não foi possível gerar a fatura"),
  });

  const atualizarStatus = useMutation({
    mutationFn: async ({ faturaId, status }: { faturaId: string; status: FaturaStatus }) => {
      const payload: Record<string, unknown> = { status };
      if (status === "fechada") payload.data_emissao = new Date().toISOString();
      if (status === "paga") payload.data_pagamento = new Date().toISOString();
      if (status === "aberta") payload.data_pagamento = null;

      const { error } = await db.from("lojista_faturas").update(payload).eq("id", faturaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status da fatura atualizado");
      queryClient.invalidateQueries({ queryKey: ["lojista-faturas"] });
      queryClient.invalidateQueries({ queryKey: ["recebimentos"] });
    },
    onError: (error: any) => toast.error(error.message || "Não foi possível atualizar a fatura"),
  });

  const filteredFaturas = useMemo(() => {
    return faturas.filter((fatura) => {
      const matchLojista = lojistaFiltro === "todos" || fatura.lojista_id === lojistaFiltro;
      const matchMes = !mesFiltro || fatura.mes_competencia === mesFiltro;
      const matchStatus = statusFiltro === "todos" || fatura.status === statusFiltro;
      return matchLojista && matchMes && matchStatus;
    });
  }, [faturas, lojistaFiltro, mesFiltro, statusFiltro]);

  const totalAberto = filteredFaturas
    .filter((fatura) => fatura.status !== "paga" && fatura.status !== "cancelada")
    .reduce((sum, fatura) => sum + Number(fatura.total_geral ?? 0), 0);

  const isLoading = loadingFaturas || loadingLojistas;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Faturas B2B</h1>
          <p className="page-subtitle">Faturamento consolidado mensal por lojista parceiro</p>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Faturas filtradas</p>
          <p className="mt-1 text-2xl font-semibold">{filteredFaturas.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total em aberto</p>
          <p className="mt-1 text-2xl font-semibold">{money(totalAberto)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Lojistas ativos</p>
          <p className="mt-1 text-2xl font-semibold">{lojistas.length}</p>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_160px_auto] md:items-end">
          <div className="space-y-2">
            <Label>Gerar fatura do mês</Label>
            <Select value={gerarLojistaId} onValueChange={setGerarLojistaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o lojista" />
              </SelectTrigger>
              <SelectContent>
                {lojistas.map((lojista) => (
                  <SelectItem key={lojista.id} value={lojista.id}>{lojista.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mês</Label>
            <Input type="month" value={gerarMes} onChange={(event) => setGerarMes(event.target.value)} />
          </div>
          <Button onClick={() => gerarFatura.mutate()} disabled={gerarFatura.isPending || !gerarLojistaId}>
            {gerarFatura.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}
            Gerar fatura
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Lojista</Label>
            <Select value={lojistaFiltro} onValueChange={setLojistaFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {lojistas.map((lojista) => (
                  <SelectItem key={lojista.id} value={lojista.id}>{lojista.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mês</Label>
            <Input type="month" value={mesFiltro} onChange={(event) => setMesFiltro(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="fechada">Fechada</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filteredFaturas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <Search className="h-8 w-8" />
              <p>Nenhuma fatura encontrada para os filtros selecionados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lojista</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Serviços</TableHead>
                  <TableHead className="text-right">Peças</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-28 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFaturas.map((fatura) => (
                  <TableRow key={fatura.id}>
                    <TableCell className="font-medium">{fatura.lojistas?.nome ?? "Lojista"}</TableCell>
                    <TableCell>{fatura.mes_competencia}</TableCell>
                    <TableCell><StatusBadge status={fatura.status} /></TableCell>
                    <TableCell className="text-right">{money(fatura.total_servicos)}</TableCell>
                    <TableCell className="text-right">{money(fatura.total_pecas)}</TableCell>
                    <TableCell className="text-right font-semibold">{money(fatura.total_geral)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedFatura(fatura)}>Abrir</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <Dialog open={!!selectedFatura} onOpenChange={(open) => !open && setSelectedFatura(null)}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          {selectedFatura && (
            <>
              <DialogHeader>
                <DialogTitle>Fatura {selectedFatura.lojistas?.nome ?? "Lojista"} — {selectedFatura.mes_competencia}</DialogTitle>
                <DialogDescription>OSs entregues vinculadas ao fechamento mensal do parceiro.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 md:grid-cols-4">
                <Summary label="Status" value={statusLabels[selectedFatura.status]} />
                <Summary label="Serviços" value={money(selectedFatura.total_servicos)} />
                <Summary label="Peças" value={money(selectedFatura.total_pecas)} />
                <Summary label="Total" value={money(selectedFatura.total_geral)} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => atualizarStatus.mutate({ faturaId: selectedFatura.id, status: "fechada" })}
                  disabled={atualizarStatus.isPending || selectedFatura.status === "fechada" || selectedFatura.status === "paga"}
                >
                  Marcar como fechada
                </Button>
                <Button
                  onClick={() => atualizarStatus.mutate({ faturaId: selectedFatura.id, status: "paga" })}
                  disabled={atualizarStatus.isPending || selectedFatura.status === "paga" || selectedFatura.status === "cancelada"}
                >
                  <WalletCards className="h-4 w-4" />
                  Marcar como paga
                </Button>
                <Button
                  variant="outline"
                  onClick={() => atualizarStatus.mutate({ faturaId: selectedFatura.id, status: "aberta" })}
                  disabled={atualizarStatus.isPending || selectedFatura.status === "aberta"}
                >
                  Reabrir
                </Button>
                <Button variant="outline" disabled>Exportar PDF</Button>
              </div>

              <div className="rounded-lg border">
                {loadingOrdens ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : ordensFatura.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma OS vinculada a esta fatura.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>OS</TableHead>
                        <TableHead>Aparelho</TableHead>
                        <TableHead>Cliente final</TableHead>
                        <TableHead className="text-right">Serviço</TableHead>
                        <TableHead className="text-right">Peças</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordensFatura.map((ordem) => (
                        <TableRow key={ordem.id}>
                          <TableCell className="font-medium">{ordem.numero_formatado ?? `#${ordem.numero}`}</TableCell>
                          <TableCell>{[ordem.aparelhos?.marca, ordem.aparelhos?.modelo].filter(Boolean).join(" ") || "—"}</TableCell>
                          <TableCell>{ordem.aparelhos?.clientes?.nome ?? "—"}</TableCell>
                          <TableCell className="text-right">{money(ordem.valor_total_servicos)}</TableCell>
                          <TableCell className="text-right">{money(ordem.custo_pecas)}</TableCell>
                          <TableCell className="text-right font-semibold">{money(ordem.valor_total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: FaturaStatus }) {
  const variant = status === "paga" ? "default" : status === "cancelada" ? "destructive" : "secondary";
  return <Badge variant={variant}>{statusLabels[status]}</Badge>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
