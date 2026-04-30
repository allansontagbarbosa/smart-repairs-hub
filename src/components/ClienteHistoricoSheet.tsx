import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Smartphone, ChevronDown, ChevronRight, MessageCircle, Eye, Wrench, Loader2, CreditCard } from "lucide-react";
import { abrirWhatsApp } from "@/lib/whatsapp";
import { useCriarPagamentoCliente } from "@/hooks/usePagamentosCliente";
import type { Database } from "@/integrations/supabase/types";

const FORMAS_PAGAMENTO = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro" },
];

type Status = Database["public"]["Enums"]["status_ordem"];

type PagamentoCliente = Database["public"]["Tables"]["pagamentos_clientes"]["Row"];

interface ClienteInfo {
  id: string;
  cliente_id?: string;
  nome: string;
  whatsapp: string | null;
  telefone: string;
  total_os?: number;
  total_gasto?: number;
  ultimo_atendimento?: string | null;
  total_faturado?: number;
  total_recebido?: number;
  saldo_devedor?: number;
  qtd_oss?: number;
  ultima_os_data?: string | null;
  ultimo_pagamento_data?: string | null;
}

export function ClienteHistorico({ cliente }: { cliente: ClienteInfo }) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [pagamentoOpen, setPagamentoOpen] = useState(false);

  const { data: aparelhos = [], isLoading: loadingAparelhos } = useQuery({
    queryKey: ["cliente-aparelhos", cliente.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aparelhos")
        .select("id, marca, modelo, cor, capacidade, imei")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ordensComApId = [], isLoading: loadingOrdens } = useQuery({
    queryKey: ["cliente-ordens-full", cliente.id],
    queryFn: async () => {
      const apIds = aparelhos.map((a) => a.id);
      if (!apIds.length) return [];
      const { data, error } = await supabase
        .from("ordens_de_servico")
        .select("id, numero, numero_formatado, data_entrada, defeito_relatado, status, valor, aparelho_id")
        .in("aparelho_id", apIds)
        .is("deleted_at", null)
        .order("data_entrada", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: aparelhos.length > 0,
  });

  const { data: pagamentos = [], isLoading: loadingPagamentos } = useQuery({
    queryKey: ["pagamentos-cliente", cliente.id, "ultimos-10"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_clientes")
        .select("*")
        .eq("cliente_id", cliente.id)
        .is("deleted_at", null)
        .order("data_pagamento", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const fmtDate = (d: string | null | undefined) => d ? new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR") : "—";
  const fmtCurrency = (v: number | null | undefined) =>
    Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const truncImei = (imei: string | null) => imei ? `${imei.slice(0, 8)}...` : "—";
  const totalAparelhos = aparelhos.length;
  const whatsappNum = cliente.whatsapp || cliente.telefone;
  const saldo = Number(cliente.saldo_devedor ?? 0);
  const saldoClass = saldo > 0 ? "text-destructive" : saldo < 0 ? "text-success" : "text-muted-foreground";
  const isLoading = loadingAparelhos || loadingOrdens;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SummaryCard label="Saldo Devedor" value={fmtCurrency(saldo)} valueClassName={`text-lg ${saldoClass}`} featured />
        <SummaryCard label="Total Faturado" value={fmtCurrency(cliente.total_faturado ?? cliente.total_gasto ?? 0)} />
        <SummaryCard label="Total Recebido" value={fmtCurrency(cliente.total_recebido ?? 0)} />
        <SummaryCard label="Qtd OSs" value={String(cliente.qtd_oss ?? cliente.total_os ?? 0)} />
        <SummaryCard label="Última OS" value={fmtDate(cliente.ultima_os_data ?? cliente.ultimo_atendimento)} />
        <SummaryCard label="Último Pagamento" value={fmtDate(cliente.ultimo_pagamento_data)} />
      </div>

      <Button className="w-full mt-3 gap-2" onClick={() => setPagamentoOpen(true)}>
        <CreditCard className="h-4 w-4" />
        Registrar Pagamento
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="w-full mt-3"
        onClick={() => abrirWhatsApp(whatsappNum, `Olá ${cliente.nome}, tudo bem?`)}
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        Enviar WhatsApp
      </Button>

      <Separator className="my-4" />

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Aparelhos ({totalAparelhos})
            </p>
            {aparelhos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aparelho cadastrado.</p>
            ) : (
              <div className="space-y-1.5">
                {aparelhos.map((ap) => {
                  const apOrdens = ordensComApId.filter((o) => o.aparelho_id === ap.id);
                  return (
                    <AparelhoItem
                      key={ap.id}
                      aparelho={ap}
                      ordens={apOrdens}
                      fmtDate={fmtDate}
                      fmtCurrency={fmtCurrency}
                      truncImei={truncImei}
                      onViewOS={setSelectedOrderId}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <Separator className="my-4" />

          <HistoricoPagamentos pagamentos={pagamentos} isLoading={loadingPagamentos} fmtDate={fmtDate} fmtCurrency={fmtCurrency} />

          <Separator className="my-4" />

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Timeline de OS
            </p>
            {ordensComApId.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ordem de serviço.</p>
            ) : (
              <div className="relative pl-4">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                {ordensComApId.map((os) => {
                  const ap = aparelhos.find((a) => a.id === os.aparelho_id);
                  return (
                    <div
                      key={os.id}
                      className="relative flex items-start gap-3 pb-4 last:pb-0 cursor-pointer group"
                      onClick={() => setSelectedOrderId(os.id)}
                    >
                      <div className="absolute left-[-13px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background z-10" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">{fmtDate(os.data_entrada)}</span>
                          <span className="text-xs font-medium">#{formatNumeroOS((os as any).numero, (os as any).numero_formatado)}</span>
                          <StatusBadge status={os.status} />
                        </div>
                        <p className="text-sm mt-0.5 truncate">
                          {ap ? `${ap.marca} ${ap.modelo}` : "Aparelho"} — {os.defeito_relatado}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {os.valor ? <span className="text-xs font-medium text-foreground">{fmtCurrency(os.valor)}</span> : null}
                          <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Eye className="h-3 w-3" /> Ver OS
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <RegistrarPagamentoDialog open={pagamentoOpen} onOpenChange={setPagamentoOpen} clienteId={cliente.id} />
      <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </>
  );
}

function SummaryCard({ label, value, valueClassName = "", featured = false }: { label: string; value: string; valueClassName?: string; featured?: boolean }) {
  return (
    <div className={`rounded-lg border bg-muted/30 p-2 ${featured ? "col-span-2 sm:col-span-1" : ""}`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 truncate ${valueClassName}`}>{value}</p>
    </div>
  );
}

export function RegistrarPagamentoDialog({ open, onOpenChange, clienteId }: { open: boolean; onOpenChange: (open: boolean) => void; clienteId: string }) {
  const [valor, setValor] = useState(0);
  const [forma, setForma] = useState("pix");
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split("T")[0]);
  const [observacoes, setObservacoes] = useState("");
  const criarPagamento = useCriarPagamentoCliente();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (valor <= 0) {
      return;
    }
    criarPagamento.mutate(
      { cliente_id: clienteId, valor, forma_pagamento: forma, data_pagamento: dataPagamento, observacoes: observacoes || undefined },
      {
        onSuccess: () => {
          setValor(0);
          setForma("pix");
          setDataPagamento(new Date().toISOString().split("T")[0]);
          setObservacoes("");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-xs">Valor</Label>
            <CurrencyInput value={valor} onValueChange={setValor} className="mt-1.5" placeholder="0,00" />
            {valor <= 0 ? <p className="mt-1 text-xs text-muted-foreground">Informe um valor maior que zero.</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={forma} onValueChange={setForma}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data do pagamento</Label>
              <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} className="mt-1.5 resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={valor <= 0 || criarPagamento.isPending}>
              {criarPagamento.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HistoricoPagamentos({ pagamentos, isLoading, fmtDate, fmtCurrency }: { pagamentos: PagamentoCliente[]; isLoading: boolean; fmtDate: (d: string | null | undefined) => string; fmtCurrency: (v: number | null | undefined) => string }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico de Pagamentos</p>
        <Button size="sm" variant="ghost" disabled className="h-7 px-2 text-xs">Ver todos no extrato</Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : pagamentos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pagamento registrado ainda</p>
      ) : (
        <div className="space-y-2">
          {pagamentos.map((pagamento) => (
            <div key={pagamento.id} className="rounded-md border bg-muted/20 p-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium capitalize">{pagamento.forma_pagamento.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(pagamento.data_pagamento)}</p>
                </div>
                <p className="text-sm font-semibold text-success">{fmtCurrency(pagamento.valor)}</p>
              </div>
              {pagamento.observacoes ? <p className="mt-1 text-xs text-muted-foreground">{pagamento.observacoes}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AparelhoItem({
  aparelho,
  ordens,
  fmtDate,
  fmtCurrency,
  truncImei,
  onViewOS,
}: {
  aparelho: { id: string; marca: string; modelo: string; cor: string | null; capacidade: string | null; imei: string | null };
  ordens: { id: string; numero: number; data_entrada: string; defeito_relatado: string; status: Status; valor: number | null }[];
  fmtDate: (d: string | null | undefined) => string;
  fmtCurrency: (v: number | null | undefined) => string;
  truncImei: (imei: string | null) => string;
  onViewOS: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors text-left">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{aparelho.marca} {aparelho.modelo}</span>
          <span className="text-xs text-muted-foreground ml-2">
            {[aparelho.cor, aparelho.capacidade].filter(Boolean).join(" • ") || ""}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">{truncImei(aparelho.imei)}</span>
        <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full">{ordens.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-8 pr-2 pb-1">
        {ordens.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">Nenhuma OS para este aparelho.</p>
        ) : (
          <div className="space-y-1">
            {ordens.map((os) => (
              <div
                key={os.id}
                className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onViewOS(os.id)}
              >
                <span className="text-xs font-medium w-10">#{formatNumeroOS((os as any).numero, (os as any).numero_formatado)}</span>
                <span className="text-xs text-muted-foreground w-16">{fmtDate(os.data_entrada)}</span>
                <span className="text-xs truncate flex-1">{os.defeito_relatado}</span>
                <StatusBadge status={os.status} />
                <span className="text-xs font-medium w-20 text-right">{fmtCurrency(os.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
