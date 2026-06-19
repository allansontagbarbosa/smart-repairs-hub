import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { formatBRL } from "@/lib/utils";
import {
  Handshake, CheckCircle2, XCircle, RefreshCw, Loader2, MessageSquare,
} from "lucide-react";
import { usePermissoesAtacado } from "@/hooks/usePermissoesAtacado";
import { statusBadge } from "@/components/atacado/OfertaDialogs";

type Oferta = {
  id: string;
  empresa_id: string;
  catalogo_slug: string;
  modelo: string | null;
  capacidade: string | null;
  cor: string | null;
  grade: string | null;
  condicao: string | null;
  quantidade: number;
  valor_oferta: number;
  cliente_nome: string;
  cliente_contato: string;
  status: string;
  mensagem: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

type Round = {
  id: string; oferta_id: string; autor: "cliente" | "vendedor";
  valor: number; mensagem: string | null; created_at: string;
};

export default function AtacadoOfertas() {
  const perms = usePermissoesAtacado();
  const qc = useQueryClient();
  const [statusFiltro, setStatusFiltro] = useState<string>("ativas");
  const [busca, setBusca] = useState("");
  const [oferta, setOferta] = useState<Oferta | null>(null);

  const listQ = useQuery({
    queryKey: ["atacado-ofertas", statusFiltro],
    queryFn: async () => {
      let q = supabase
        .from("atacado_ofertas" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (statusFiltro === "ativas") {
        q = q.in("status", ["pendente", "contraoferta"]);
      } else if (statusFiltro !== "todas") {
        q = q.eq("status", statusFiltro);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as Oferta[]) ?? [];
    },
  });

  const ofertas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (listQ.data ?? []).filter((o) => {
      if (!t) return true;
      return [o.modelo, o.cliente_nome, o.cliente_contato, o.capacidade, o.cor]
        .filter(Boolean).join(" ").toLowerCase().includes(t);
    });
  }, [listQ.data, busca]);

  const counts = useMemo(() => {
    const arr = listQ.data ?? [];
    return {
      pendente: arr.filter((o) => o.status === "pendente").length,
      contraoferta: arr.filter((o) => o.status === "contraoferta").length,
    };
  }, [listQ.data]);

  if (!perms.podeVerPedidos) {
    return <div className="p-6">Sem acesso.</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Handshake className="h-5 w-5" /> Ofertas
          </h1>
          <p className="text-sm text-muted-foreground">
            Negociações de clientes no catálogo público
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{counts.pendente} pendentes</Badge>
          <Badge variant="default">{counts.contraoferta} em contraoferta</Badge>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Buscar por modelo, cliente, contato…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex-1"
        />
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativas">Ativas (pendentes + contra)</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="contraoferta">Contraoferta</SelectItem>
            <SelectItem value="aceita">Aceita</SelectItem>
            <SelectItem value="finalizada">Finalizada</SelectItem>
            <SelectItem value="recusada">Recusada</SelectItem>
            <SelectItem value="expirada">Expirada</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        {listQ.isLoading ? (
          <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : listQ.isError ? (
          <div className="p-6 text-sm text-destructive">Erro ao carregar ofertas.</div>
        ) : ofertas.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Sem ofertas para este filtro.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Valor atual</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ofertas.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={() => setOferta(o)}
                >
                  <TableCell>
                    <div className="font-medium">{o.modelo} {o.capacidade ?? ""}</div>
                    <div className="text-xs text-muted-foreground">
                      {[o.cor, o.grade, o.condicao].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{o.cliente_nome}</div>
                    <div className="text-xs text-muted-foreground">{o.cliente_contato}</div>
                  </TableCell>
                  <TableCell className="text-right">{o.quantidade}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatBRL(Number(o.valor_oferta))}
                  </TableCell>
                  <TableCell>{statusBadge(o.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(o.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <OfertaDialog
        oferta={oferta}
        onClose={() => setOferta(null)}
        onChanged={() => qc.invalidateQueries({ queryKey: ["atacado-ofertas"] })}
        verFinanceiro={perms.podeVerFinanceiro}
      />
    </div>
  );
}

function OfertaDialog({
  oferta, onClose, onChanged, verFinanceiro,
}: {
  oferta: Oferta | null;
  onClose: () => void;
  onChanged: () => void;
  verFinanceiro: boolean;
}) {
  const [valorContra, setValorContra] = useState(0);
  const [msg, setMsg] = useState("");
  const [showContra, setShowContra] = useState(false);

  const roundsQ = useQuery({
    queryKey: ["oferta-rounds", oferta?.id],
    enabled: !!oferta?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atacado_ofertas_rounds" as any)
        .select("*")
        .eq("oferta_id", oferta!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as Round[]) ?? [];
    },
  });

  // custo do aparelho (média do grupo) para calcular margem
  const custoQ = useQuery({
    queryKey: ["oferta-custo-grupo", oferta?.id],
    enabled: !!oferta?.id && verFinanceiro,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atacado_aparelhos")
        .select("custo,quantidade")
        .eq("empresa_id", oferta!.empresa_id)
        .eq("modelo", oferta!.modelo ?? "")
        .is("deleted_at", null);
      if (error) throw error;
      const arr = (data ?? []) as { custo: number | null; quantidade: number }[];
      const tot = arr.reduce((s, r) => s + (Number(r.custo) || 0) * (r.quantidade || 0), 0);
      const q = arr.reduce((s, r) => s + (r.quantidade || 0), 0);
      return q > 0 ? tot / q : null;
    },
  });

  const responder = useMutation({
    mutationFn: async (vars: {
      acao: "aceitar" | "recusar" | "contraofertar";
      valor?: number; msg?: string;
    }) => {
      const { error } = await supabase.rpc("oferta_responder_vendedor" as any, {
        p_oferta_id: oferta!.id,
        p_acao: vars.acao,
        p_valor: vars.valor ?? null,
        p_msg: vars.msg ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setShowContra(false); setValorContra(0); setMsg("");
      onChanged();
      onClose();
    },
  });

  if (!oferta) return null;
  const podeAgir = ["pendente", "contraoferta"].includes(oferta.status);
  const custoUnit = custoQ.data ?? null;
  const valorUnit = Number(oferta.valor_oferta);
  const margemUnit = custoUnit != null ? valorUnit - custoUnit : null;
  const margemPct = custoUnit != null && valorUnit > 0
    ? ((valorUnit - custoUnit) / valorUnit) * 100
    : null;

  return (
    <Dialog open={!!oferta} onOpenChange={(b) => { if (!b) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Oferta — {oferta.modelo} {oferta.capacidade ?? ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Info label="Cliente" value={oferta.cliente_nome} />
            <Info label="Contato" value={oferta.cliente_contato} />
            <Info label="Quantidade" value={String(oferta.quantidade)} />
            <Info label="Status" value={<span>{statusBadge(oferta.status)}</span>} />
            <Info label="Valor atual (unit.)" value={formatBRL(valorUnit)} />
            <Info label="Total" value={formatBRL(valorUnit * oferta.quantidade)} />
            {verFinanceiro && custoUnit != null && (
              <>
                <Info label="Custo médio" value={formatBRL(custoUnit)} />
                <Info
                  label="Margem"
                  value={
                    <span className={margemUnit && margemUnit < 0 ? "text-destructive" : ""}>
                      {margemUnit != null ? formatBRL(margemUnit) : "—"}
                      {margemPct != null ? ` · ${margemPct.toFixed(1)}%` : ""}
                    </span>
                  }
                />
              </>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> Histórico
            </p>
            <div className="border rounded p-2 max-h-56 overflow-auto space-y-1.5">
              {(roundsQ.data ?? []).map((r) => (
                <div key={r.id} className="text-xs flex items-start gap-2">
                  <Badge variant={r.autor === "cliente" ? "secondary" : "default"} className="capitalize shrink-0">
                    {r.autor}
                  </Badge>
                  <div className="min-w-0">
                    <span className="font-medium">{formatBRL(Number(r.valor))}</span>
                    {r.mensagem && <span className="text-muted-foreground"> — {r.mensagem}</span>}
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {podeAgir && (
            <div className="border-t pt-2 space-y-2">
              {!showContra ? (
                <div className="grid grid-cols-3 gap-2">
                  <Button onClick={() => responder.mutate({ acao: "aceitar" })}
                    disabled={responder.isPending}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Aceitar
                  </Button>
                  <Button variant="outline" onClick={() => setShowContra(true)}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Contraofertar
                  </Button>
                  <Button variant="destructive"
                    onClick={() => responder.mutate({ acao: "recusar" })}
                    disabled={responder.isPending}>
                    <XCircle className="h-4 w-4 mr-1" /> Recusar
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Sua contraoferta (unit.)</Label>
                      <CurrencyInput value={valorContra} onValueChange={setValorContra} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Mensagem (opcional)</Label>
                      <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={1} maxLength={500} />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowContra(false)}>Cancelar</Button>
                    <Button
                      disabled={valorContra <= 0 || responder.isPending}
                      onClick={() => responder.mutate({ acao: "contraofertar", valor: valorContra, msg })}
                    >
                      Enviar contraoferta
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
