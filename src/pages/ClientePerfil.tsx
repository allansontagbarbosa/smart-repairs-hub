import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, FileDown, Loader2, Plus, Smartphone } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useClientesSaldos } from "@/hooks/useClientesSaldos";
import { useExtratoCliente, type ExtratoClienteItem } from "@/hooks/useExtratoCliente";
import { usePagamentosClienteLista } from "@/hooks/usePagamentosClienteLista";
import { RegistrarPagamentoDialog } from "@/components/ClienteHistoricoSheet";
import { NovaOrdemDialog } from "@/components/NovaOrdemDialog";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TipoClienteSwitch } from "@/components/clientes/TipoClienteSwitch";
import { AcessoPortalSection } from "@/components/clientes/AcessoPortalSection";
import { DadosClienteEditavel } from "@/components/clientes/DadosClienteEditavel";

type Periodo = "mes" | "3m" | "6m" | "custom";

type AparelhoCliente = {
  id: string;
  marca: string | null;
  modelo: string | null;
  cor: string | null;
  capacidade: string | null;
  imei: string | null;
  created_at: string | null;
  ordens_de_servico?: Array<{
    id: string;
    numero: number | null;
    numero_formatado: string | null;
    data_entrada: string | null;
    defeito_relatado: string | null;
    status: string;
    valor: number | null;
  }>;
};

const fmtCurrency = (v: number | null | undefined) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null | undefined) => d ? new Date(d.includes("T") ? d : `${d}T00:00:00`).toLocaleDateString("pt-BR") : "—";
const toISODate = (d: Date) => d.toISOString().split("T")[0];
const currentDate = new Date();
const aparelhoImei = (item: ExtratoClienteItem) => [item.modelo_aparelho, item.imei ? `IMEI ${item.imei}` : null].filter(Boolean).join(" • ") || "—";
const servicosLabel = (item: ExtratoClienteItem) => item.tipo === "pagamento" ? item.descricao.replace(/^Pagamento\s*/i, "") || "—" : item.servicos_realizados || "—";
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
};

export default function ClientePerfil() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [periodo, setPeriodoState] = useState<Periodo>((searchParams.get("periodo") as Periodo) || "6m");
  const [customInicio, setCustomInicioState] = useState(searchParams.get("inicio") || "");
  const [customFim, setCustomFimState] = useState(searchParams.get("fim") || "");
  const [pagamentoOpen, setPagamentoOpen] = useState(false);
  const [novaOsOpen, setNovaOsOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: clientes = [], isLoading: loadingClientes } = useClientesSaldos();
  const cliente = clientes.find((item) => item.id === id || item.cliente_id === id);

  const periodoFiltro = useMemo(() => {
    const today = new Date();
    if (periodo === "custom") return { inicio: customInicio || undefined, fim: customFim || undefined };
    if (periodo === "mes") return { inicio: toISODate(new Date(today.getFullYear(), today.getMonth(), 1)), fim: toISODate(today) };
    const months = periodo === "3m" ? 2 : 5;
    return { inicio: toISODate(new Date(today.getFullYear(), today.getMonth() - months, 1)), fim: toISODate(today) };
  }, [customFim, customInicio, periodo]);
  const exportInicio = periodoFiltro.inicio ?? toISODate(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  const exportFim = periodoFiltro.fim ?? toISODate(currentDate);

  const { data: extrato = [], isLoading: loadingExtrato } = useExtratoCliente(id, periodoFiltro.inicio, periodoFiltro.fim);
  const { data: pagamentos = [], isLoading: loadingPagamentos } = usePagamentosClienteLista(id);

  const { data: clienteCompleto } = useQuery({
    enabled: !!id,
    queryKey: ["cliente-completo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, email, telefone, whatsapp, cpf, documento, data_nascimento, cep, rua, numero_endereco, complemento, bairro, cidade, estado, observacoes")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: aparelhos = [], isLoading: loadingAparelhos } = useQuery({
    enabled: !!id,
    queryKey: ["cliente-aparelhos-com-ordens", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aparelhos")
        .select("id, marca, modelo, cor, capacidade, imei, created_at, ordens_de_servico ( id, numero, numero_formatado, data_entrada, defeito_relatado, status, valor )")
        .eq("cliente_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AparelhoCliente[];
    },
  });

  const chartData = useMemo(() => buildMonthlyData(extrato), [extrato]);
  const saldo = Number(cliente?.saldo_devedor ?? 0);
  const saldoClass = saldo > 0 ? "text-destructive" : saldo < 0 ? "text-success" : "text-muted-foreground";
  const saldoBgClass = saldo > 0 ? "bg-destructive/10 border-destructive/30" : saldo < 0 ? "bg-success/10 border-success/30" : "bg-muted/30";
  const ticketMedio = Number(cliente?.qtd_oss ?? 0) > 0 ? Number(cliente?.total_faturado ?? 0) / Number(cliente?.qtd_oss ?? 1) : 0;
  const atualizacoes = [cliente?.ultima_os_data, cliente?.ultimo_pagamento_data].filter(Boolean).sort();
  const ultimaAtualizacao = atualizacoes.length > 0 ? atualizacoes[atualizacoes.length - 1] : null;

  const setPeriodo = (value: Periodo) => {
    setPeriodoState(value);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("periodo", value);
      return next;
    });
  };

  const setCustomInicio = (value: string) => {
    setCustomInicioState(value);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      value ? next.set("inicio", value) : next.delete("inicio");
      return next;
    });
  };

  const setCustomFim = (value: string) => {
    setCustomFimState(value);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      value ? next.set("fim", value) : next.delete("fim");
      return next;
    });
  };

  if (loadingClientes) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!cliente) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild><Link to="/clientes"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Link></Button>
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">Cliente não encontrado.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="page-header !mb-0">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate("/clientes")}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Button>
          <h1 className="page-title">{cliente.nome}</h1>
          <p className="page-subtitle">Conta-corrente B2B e histórico operacional</p>
        </div>
        <Button onClick={() => setNovaOsOpen(true)} className="gap-2"><Plus className="h-4 w-4" />Nova OS</Button>
      </div>

      <TipoClienteSwitch clienteId={cliente.id} tipoAtual={(cliente as any).tipo_cliente ?? "consumidor_b2c"} />

      <AcessoPortalSection
        clienteId={cliente.id}
        clienteNome={cliente.nome}
        clienteEmail={(cliente as any).email}
        clienteTelefone={(cliente as any).telefone}
        tipoCliente={((cliente as any).tipo_cliente ?? "consumidor_b2c") as "lojista_b2b" | "consumidor_b2c"}
      />

      {clienteCompleto && <DadosClienteEditavel cliente={clienteCompleto as any} />}

      <div className={`rounded-lg border p-5 ${saldoBgClass}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saldo devedor atual</p>
            <p className={`mt-1 text-4xl font-bold ${saldoClass}`}>{fmtCurrency(saldo)}</p>
            <p className="mt-2 text-sm text-muted-foreground">Última atualização: {fmtDate(ultimaAtualizacao)}</p>
          </div>
          <Button size="lg" className="gap-2" onClick={() => setPagamentoOpen(true)}><CreditCard className="h-4 w-4" />Registrar Pagamento</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Kpi label="Total Faturado" value={fmtCurrency(cliente.total_faturado)} />
        <Kpi label="Total Recebido" value={fmtCurrency(cliente.total_recebido)} />
        <Kpi label="Qtd OSs faturadas" value={String(cliente.qtd_oss ?? 0)} />
        <Kpi label="Ticket médio" value={fmtCurrency(ticketMedio)} />
        <Kpi label="Última OS" value={fmtDate(cliente.ultima_os_data)} />
        <Kpi label="Último Pagamento" value={fmtDate(cliente.ultimo_pagamento_data)} />
      </div>

      <ClienteAnaliseMensal data={chartData} />

      <Tabs defaultValue="extrato" className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="extrato">Extrato</TabsTrigger>
          <TabsTrigger value="aparelhos">Aparelhos</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="extrato">
          <ExtratoTab
            extrato={extrato}
            isLoading={loadingExtrato}
            periodo={periodo}
            setPeriodo={setPeriodo}
            customInicio={customInicio}
            setCustomInicio={setCustomInicio}
            customFim={customFim}
            setCustomFim={setCustomFim}
            onExportPDF={() => navigate(`/financeiro/faturas-lojistas?cliente=${id}&inicio=${exportInicio}&fim=${exportFim}`)}
          />
        </TabsContent>

        <TabsContent value="aparelhos">
          <AparelhosTab aparelhos={aparelhos} isLoading={loadingAparelhos} onViewOS={setSelectedOrderId} />
        </TabsContent>

        <TabsContent value="pagamentos">
          <PagamentosTab pagamentos={pagamentos} isLoading={loadingPagamentos} onRegistrar={() => setPagamentoOpen(true)} />
        </TabsContent>
      </Tabs>

      <RegistrarPagamentoDialog open={pagamentoOpen} onOpenChange={setPagamentoOpen} clienteId={id} />
      <NovaOrdemDialog
        open={novaOsOpen}
        onOpenChange={setNovaOsOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["clientes-saldos"] });
          queryClient.invalidateQueries({ queryKey: ["extrato-cliente"] });
          setNovaOsOpen(false);
        }}
        preSelectedClientId={id}
      />
      <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-card p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold truncate">{value}</p></div>;
}

function ClienteAnaliseMensal({ data }: { data: Array<{ mes: string; faturamento: number; recebido: number }> }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Análise mensal</h2>
          <p className="text-sm text-muted-foreground">Faturamento e recebimentos dos últimos meses</p>
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `R$ ${v}`} />
            <Tooltip formatter={(value) => fmtCurrency(Number(value))} cursor={{ fill: "hsl(var(--muted))" }} />
            <Bar dataKey="faturamento" name="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="recebido" name="Recebido" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ExtratoTab({ extrato, isLoading, periodo, setPeriodo, customInicio, setCustomInicio, customFim, setCustomFim, onExportPDF }: {
  extrato: ExtratoClienteItem[];
  isLoading: boolean;
  periodo: Periodo;
  setPeriodo: (p: Periodo) => void;
  customInicio: string;
  setCustomInicio: (v: string) => void;
  customFim: string;
  setCustomFim: (v: string) => void;
  onExportPDF: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Extrato</h2>
          <Button size="sm" variant="outline" onClick={onExportPDF} className="gap-1.5">
            <FileDown className="h-3.5 w-3.5" /> Exportar PDF
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([ ["mes", "Mês corrente"], ["3m", "3 meses"], ["6m", "6 meses"], ["custom", "Custom"] ] as Array<[Periodo, string]>).map(([value, label]) => (
            <Button key={value} type="button" size="sm" variant={periodo === value ? "default" : "outline"} onClick={() => setPeriodo(value)}>{label}</Button>
          ))}
          {periodo === "custom" ? <><Input type="date" value={customInicio} onChange={(e) => setCustomInicio(e.target.value)} className="h-9 w-36" /><Input type="date" value={customFim} onChange={(e) => setCustomFim(e.target.value)} className="h-9 w-36" /></> : null}
        </div>
      </div>
      {isLoading ? <Loading /> : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[1120px]">
            <thead><tr><th>Data</th><th>OS</th><th>Aparelho/IMEI</th><th>Serviço(s)</th><th className="text-right">Débito</th><th className="text-right">Crédito</th><th className="text-right">Saldo após</th></tr></thead>
            <tbody>
              {extrato.map((item) => (
                <tr key={`${item.tipo}-${item.referencia_id}-${item.data}`} className={item.tipo === "pagamento" ? "bg-success/10" : ""}>
                  <td className="text-sm text-muted-foreground">{fmtDate(item.data)}</td>
                  <td className="text-sm font-medium">{item.descricao}</td>
                  <td className="max-w-xs whitespace-normal text-sm text-muted-foreground">{aparelhoImei(item)}</td>
                  <td className="max-w-xs whitespace-normal text-sm text-muted-foreground">{servicosLabel(item)}</td>
                  <td className="text-right text-sm">{Number(item.debito) > 0 ? fmtCurrency(item.debito) : "—"}</td>
                  <td className="text-right text-sm text-success">{Number(item.credito) > 0 ? fmtCurrency(item.credito) : "—"}</td>
                  <td className="text-right text-sm font-semibold">{fmtCurrency(item.saldo_apos)}</td>
                </tr>
              ))}
              {extrato.length === 0 ? <tr><td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">Nenhuma movimentação no período.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AparelhosTab({ aparelhos, isLoading, onViewOS }: { aparelhos: AparelhoCliente[]; isLoading: boolean; onViewOS: (id: string) => void }) {
  if (isLoading) return <Loading />;
  return (
    <div className="space-y-3">
      {aparelhos.map((ap) => (
        <div key={ap.id} className="rounded-lg border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary"><Smartphone className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{[ap.marca, ap.modelo].filter(Boolean).join(" ") || "Aparelho"}</p>
              <p className="text-sm text-muted-foreground">{[ap.cor, ap.capacidade, ap.imei ? `IMEI ${ap.imei}` : null].filter(Boolean).join(" • ") || "Sem detalhes"}</p>
              <div className="mt-3 space-y-2">
                {(ap.ordens_de_servico ?? []).map((os) => (
                  <button key={os.id} type="button" onClick={() => onViewOS(os.id)} className="flex w-full items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2 text-left hover:bg-muted/50">
                    <span className="min-w-0"><span className="text-sm font-medium">#{os.numero_formatado || os.numero}</span><span className="ml-2 text-sm text-muted-foreground">{os.defeito_relatado || "OS sem descrição"}</span></span>
                    <span className="flex shrink-0 items-center gap-2"><StatusBadge status={os.status as never} /> <span className="text-sm font-medium">{fmtCurrency(os.valor)}</span></span>
                  </button>
                ))}
                {(ap.ordens_de_servico ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma OS vinculada.</p> : null}
              </div>
            </div>
          </div>
        </div>
      ))}
      {aparelhos.length === 0 ? <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">Nenhum aparelho cadastrado.</div> : null}
    </div>
  );
}

function PagamentosTab({ pagamentos, isLoading, onRegistrar }: { pagamentos: Array<{ id: string; data_pagamento: string | null; forma_pagamento: string | null; valor: number | null; observacoes: string | null }>; isLoading: boolean; onRegistrar: () => void }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b p-4"><h2 className="text-base font-semibold">Pagamentos</h2><Button size="sm" onClick={onRegistrar}><CreditCard className="h-4 w-4 mr-2" />Registrar Pagamento</Button></div>
      {isLoading ? <Loading /> : <div className="overflow-x-auto"><table className="data-table min-w-[720px]"><thead><tr><th>Data</th><th>Forma Pagamento</th><th className="text-right">Valor</th><th>Observações</th></tr></thead><tbody>{pagamentos.map((p) => <tr key={p.id}><td>{fmtDate(p.data_pagamento)}</td><td className="capitalize">{String(p.forma_pagamento || "—").replace(/_/g, " ")}</td><td className="text-right font-semibold text-success">{fmtCurrency(p.valor)}</td><td className="text-muted-foreground">{p.observacoes || "—"}</td></tr>)}{pagamentos.length === 0 ? <tr><td colSpan={4} className="py-10 text-center text-sm text-muted-foreground">Nenhum pagamento registrado.</td></tr> : null}</tbody></table></div>}
    </div>
  );
}

function Loading() {
  return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
}

function buildMonthlyData(extrato: ExtratoClienteItem[]) {
  const today = new Date();
  const months = Array.from({ length: 6 }, (_, index) => monthKey(new Date(today.getFullYear(), today.getMonth() - (5 - index), 1)));
  const map = new Map(months.map((key) => [key, { mes: monthLabel(key), faturamento: 0, recebido: 0 }]));
  extrato.forEach((item) => {
    const key = monthKey(new Date(item.data.includes("T") ? item.data : `${item.data}T00:00:00`));
    const row = map.get(key);
    if (!row) return;
    row.faturamento += Number(item.debito ?? 0);
    row.recebido += Number(item.credito ?? 0);
  });
  return Array.from(map.values());
}
