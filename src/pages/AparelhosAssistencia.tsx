import { useState, useRef, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Search, Smartphone, Clock, Wrench, AlertTriangle, CheckCircle, Eye, ScanLine, Play, Square, Check, X, ClipboardList, Plus, Printer } from "lucide-react";
import { NovaOrdemDialog } from "@/components/NovaOrdemDialog";
import { ConferenciaAparelhosButton } from "@/components/conferencia/ConferenciaAparelhosButton";
import { HistoricoConferencias } from "@/components/conferencia/HistoricoConferencias";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ScannableInput } from "@/components/ui/scannable-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAparelhosAssistencia, type AparelhoAssistencia } from "@/hooks/useAparelhosAssistencia";
import { printEtiquetaOS } from "@/lib/printEtiqueta";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const statusLabels: Record<string, string> = {
  recebido: "Recebido",
  em_analise: "Em análise",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  em_reparo: "Em reparo",
  aguardando_peca: "Aguardando peça",
  pronto: "Pronto",
};

const statusColors: Record<string, string> = {
  recebido: "bg-muted text-muted-foreground",
  em_analise: "bg-info/10 text-info",
  aguardando_aprovacao: "bg-warning/10 text-warning",
  aprovado: "bg-success/10 text-success",
  em_reparo: "bg-primary/10 text-primary",
  aguardando_peca: "bg-warning/10 text-warning",
  pronto: "bg-success/10 text-success",
};

// ─── Conference types ───
type ConferenciaItemState = {
  os_id: string;
  os_numero: number;
  cliente_nome: string;
  aparelho: string;
  imei: string | null;
  encontrado: boolean;
};

export default function AparelhosAssistencia() {
  const { aparelhos, kpis, lojas, tecnicos, isLoading } = useAparelhosAssistencia();
  const [tab, setTab] = useState("lista");
  const [novaOSOpen, setNovaOSOpen] = useState(false);
  const queryClient = useQueryClient();

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Aparelhos na Assistência</h1>
          <p className="page-subtitle">Aparelhos atualmente sob responsabilidade da loja</p>
        </div>
        <div className="flex gap-2">
          <ConferenciaAparelhosButton aparelhos={aparelhos} />
          <Button size="sm" className="gap-1.5 h-9" onClick={() => setNovaOSOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Nova OS
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Smartphone} label="Em assistência" value={kpis.total} />
        <KpiCard icon={Eye} label="Em análise" value={kpis.emAnalise} color="text-info" />
        <KpiCard icon={Clock} label="Aguardando peça" value={kpis.aguardandoPeca} color="text-warning" />
        <KpiCard icon={Wrench} label="Em reparo" value={kpis.emReparo} color="text-primary" />
        <KpiCard icon={CheckCircle} label="Prontos" value={kpis.prontos} color="text-success" />
        <KpiCard icon={AlertTriangle} label="Atrasados" value={kpis.atrasados} color="text-destructive" highlight={kpis.atrasados > 0} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="conferencia">Conferência</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          <AparelhosLista aparelhos={aparelhos} lojas={lojas} tecnicos={tecnicos} />
        </TabsContent>

        <TabsContent value="conferencia">
          <ConferenciaAparelhos aparelhos={aparelhos} lojas={lojas} />
        </TabsContent>

        <TabsContent value="historico">
          <HistoricoConferencias tipo="aparelhos" />
        </TabsContent>
      </Tabs>

      <NovaOrdemDialog
        open={novaOSOpen}
        onOpenChange={setNovaOSOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["aparelhos_assistencia"] })}
      />
    </div>
  );
}

// ─── KPI Card ───
function KpiCard({ icon: Icon, label, value, color, highlight }: {
  icon: any; label: string; value: number; color?: string; highlight?: boolean;
}) {
  return (
    <div className={cn("stat-card text-center py-3", highlight && "border-destructive/20 bg-destructive/5")}>
      <Icon className={cn("h-4 w-4 mb-2 mx-auto", color ?? "text-muted-foreground")} />
      <p className={cn("text-lg font-semibold", highlight && "text-destructive")}>{value}</p>
      <p className="stat-label text-[11px]">{label}</p>
    </div>
  );
}

// ─── Aparelhos List ───
function AparelhosLista({ aparelhos, lojas, tecnicos }: {
  aparelhos: AparelhoAssistencia[];
  lojas: { id: string; nome: string }[];
  tecnicos: string[];
}) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterLoja, setFilterLoja] = useState("todas");
  const [filterTecnico, setFilterTecnico] = useState("todos");

  const filtered = aparelhos.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      a.cliente_nome.toLowerCase().includes(q) ||
      a.aparelho_marca.toLowerCase().includes(q) ||
      a.aparelho_modelo.toLowerCase().includes(q) ||
      a.aparelho_imei?.toLowerCase().includes(q) ||
      String(a.os_numero).includes(q);
    const matchStatus = filterStatus === "todos" || a.status === filterStatus;
    const matchLoja = filterLoja === "todas" || a.loja_id === filterLoja;
    const matchTecnico = filterTecnico === "todos" || a.funcionario_nome === filterTecnico;
    return matchSearch && matchStatus && matchLoja && matchTecnico;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <ScannableInput
            placeholder="Buscar OS, cliente, IMEI, aparelho..."
            className="pl-9 h-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
            scannerTitle="Escanear IMEI do aparelho"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        {lojas.length > 0 && (
          <Select value={filterLoja} onValueChange={setFilterLoja}>
            <SelectTrigger className="w-full sm:w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas lojas</SelectItem>
              {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {tecnicos.length > 0 && (
          <Select value={filterTecnico} onValueChange={setFilterTecnico}>
            <SelectTrigger className="w-full sm:w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos técnicos</SelectItem>
              {tecnicos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>OS</th>
                <th>Cliente</th>
                <th className="hidden md:table-cell">Loja</th>
                <th>Aparelho</th>
                <th className="hidden lg:table-cell">IMEI</th>
                <th className="hidden sm:table-cell">Entrada</th>
                <th>Status</th>
                <th className="text-right">Total</th>
                <th className="hidden md:table-cell">Técnico</th>
                <th className="hidden lg:table-cell">Prazo</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const total = a.valor_total ?? a.valor ?? 0;
                const orc = a.aprovacao_orcamento;
                return (
                <tr key={a.os_id} className={a.prazo_vencido ? "bg-destructive/5" : ""}>
                  <td className="text-sm font-mono font-medium">#{a.os_numero_formatado || String(a.os_numero).padStart(3, "0")}</td>
                  <td className="text-sm">{a.cliente_nome}</td>
                  <td className="hidden md:table-cell text-sm text-muted-foreground">{a.loja_nome ?? "—"}</td>
                  <td>
                    <p className="text-sm font-medium">{a.aparelho_marca} {a.aparelho_modelo}</p>
                    {a.aparelho_cor && <p className="text-[10px] text-muted-foreground">{a.aparelho_cor}</p>}
                  </td>
                  <td className="hidden lg:table-cell text-xs text-muted-foreground font-mono">{a.aparelho_imei ?? "—"}</td>
                  <td className="hidden sm:table-cell text-sm text-muted-foreground">
                    {format(new Date(a.data_entrada), "dd/MM/yy", { locale: ptBR })}
                  </td>
                  <td>
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", statusColors[a.status] ?? "bg-muted text-muted-foreground")}>
                      {statusLabels[a.status] ?? a.status}
                    </span>
                    {a.prazo_vencido && (
                      <span className="ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-destructive/10 text-destructive">ATRASADO</span>
                    )}
                    {orc === "aguardando" && (
                      <span className="ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-warning/10 text-warning">AGUARDA APROV.</span>
                    )}
                    {orc === "recusado" && (
                      <span className="ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-destructive/10 text-destructive">RECUSADO</span>
                    )}
                  </td>
                  <td className="text-right text-sm font-semibold">
                    {total > 0 ? `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                  </td>
                  <td className="hidden md:table-cell text-sm text-muted-foreground">{a.funcionario_nome ?? a.tecnico ?? "—"}</td>
                  <td className="hidden lg:table-cell text-sm text-muted-foreground">
                    {a.previsao_entrega ? format(new Date(a.previsao_entrega), "dd/MM/yy", { locale: ptBR }) : "—"}
                  </td>
                  <td className="px-2 py-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => printEtiquetaOS({
                            numero: a.os_numero,
                            clienteNome: a.cliente_nome,
                            clienteTelefone: a.cliente_telefone,
                            marca: a.aparelho_marca,
                            modelo: a.aparelho_modelo,
                            capacidade: a.aparelho_capacidade,
                            defeitos: a.defeito_relatado,
                            dataEntrada: a.data_entrada,
                            previsaoEntrega: a.previsao_entrega,
                            valor: a.valor,
                            imei: a.aparelho_imei,
                            tecnicoAtribuido: a.tecnico ?? a.funcionario_nome,
                          })}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Imprimir Etiqueta</TooltipContent>
                    </Tooltip>
                  </td>
                </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="text-center text-muted-foreground py-10 text-sm">Nenhum aparelho encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t text-xs text-muted-foreground">
          {filtered.length} aparelho{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}

// ─── Conferência de Aparelhos ───
function ConferenciaAparelhos({ aparelhos, lojas }: {
  aparelhos: AparelhoAssistencia[];
  lojas: { id: string; nome: string }[];
}) {
  const [fase, setFase] = useState<"config" | "bipagem" | "resultado">("config");
  const [filterLoja, setFilterLoja] = useState("todas");
  const [responsavel, setResponsavel] = useState("");
  const [itens, setItens] = useState<ConferenciaItemState[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const aparelhosFiltrados = useMemo(() => {
    return aparelhos.filter(a => filterLoja === "todas" || a.loja_id === filterLoja);
  }, [aparelhos, filterLoja]);

  const iniciarConferencia = () => {
    if (!responsavel.trim()) {
      toast.error("Informe o responsável pela conferência");
      return;
    }
    const items: ConferenciaItemState[] = aparelhosFiltrados.map(a => ({
      os_id: a.os_id,
      os_numero: a.os_numero,
      cliente_nome: a.cliente_nome,
      aparelho: `${a.aparelho_marca} ${a.aparelho_modelo}`,
      imei: a.aparelho_imei,
      encontrado: false,
    }));
    setItens(items);
    setExtras([]);
    setFase("bipagem");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleScan = () => {
    const code = scanInput.trim();
    if (!code) return;

    const idx = itens.findIndex(i =>
      !i.encontrado && (
        (i.imei && i.imei.toLowerCase() === code.toLowerCase()) ||
        String(i.os_numero) === code ||
        i.aparelho.toLowerCase().includes(code.toLowerCase()) ||
        i.cliente_nome.toLowerCase().includes(code.toLowerCase())
      )
    );

    if (idx >= 0) {
      setItens(prev => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], encontrado: true };
        return updated;
      });
      toast.success(`✓ OS #${itens[idx].os_numero} - ${itens[idx].aparelho}`);
    } else {
      // Check if already found
      const alreadyFound = itens.find(i =>
        i.encontrado && (
          (i.imei && i.imei.toLowerCase() === code.toLowerCase()) ||
          String(i.os_numero) === code
        )
      );
      if (alreadyFound) {
        toast.info(`OS #${alreadyFound.os_numero} já foi conferido`);
      } else {
        setExtras(prev => [...prev, code]);
        toast.error(`"${code}" não encontrado na lista esperada`);
      }
    }

    setScanInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleScan(); }
  };

  const encontrados = itens.filter(i => i.encontrado).length;
  const faltando = itens.filter(i => !i.encontrado).length;
  const percentual = itens.length > 0 ? Math.round((encontrados / itens.length) * 100) : 0;

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const { data: conf, error: e1 } = await supabase
        .from("conferencias_estoque")
        .insert({
          tipo_conferencia: "aparelhos_assistencia",
          responsavel,
          status: "finalizada" as any,
          data_inicio: new Date().toISOString(),
          data_fim: new Date().toISOString(),
        })
        .select()
        .single();
      if (e1) throw e1;

      const confItens = itens.map(i => ({
        conferencia_id: conf.id,
        item_nome: `OS #${i.os_numero} - ${i.aparelho}`,
        item_tipo: "aparelho_assistencia",
        quantidade_esperada: 1,
        quantidade_contada: i.encontrado ? 1 : 0,
        divergencia: i.encontrado ? 0 : -1,
        status: i.encontrado ? "conferido" : "divergente",
      }));

      const { error: e2 } = await supabase.from("conferencia_itens").insert(confItens);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conferencias"] });
      toast.success("Conferência salva com sucesso!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // CONFIG
  if (fase === "config") {
    return (
      <div className="section-card">
        <div className="section-header">
          <h3 className="section-title">Conferência de Aparelhos na Assistência</h3>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Confira se todos os aparelhos que constam no sistema realmente estão fisicamente na assistência.
          </p>
          {lojas.length > 0 && (
            <div>
              <label className="text-sm font-medium">Filtrar por loja</label>
              <Select value={filterLoja} onValueChange={setFilterLoja}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as lojas</SelectItem>
                  {lojas.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Responsável *</label>
            <Input value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome do responsável" className="h-9 mt-1" />
          </div>
          <div className="text-sm text-muted-foreground">
            {aparelhosFiltrados.length} aparelhos serão incluídos nesta conferência
          </div>
          <Button onClick={iniciarConferencia} className="w-full gap-2" disabled={aparelhosFiltrados.length === 0}>
            <Play className="h-4 w-4" /> Iniciar Conferência
          </Button>
        </div>
      </div>
    );
  }

  // BIPAGEM
  if (fase === "bipagem") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card text-center py-3">
            <p className="text-lg font-semibold">{itens.length}</p>
            <p className="stat-label">Esperado</p>
          </div>
          <div className="stat-card text-center py-3 border-success/20 bg-success-muted">
            <p className="text-lg font-semibold text-success">{encontrados}</p>
            <p className="stat-label">Encontrado</p>
          </div>
          <div className={cn("stat-card text-center py-3", faltando > 0 && "border-warning/20 bg-warning-muted")}>
            <p className={cn("text-lg font-semibold", faltando > 0 && "text-warning")}>{faltando}</p>
            <p className="stat-label">Faltando</p>
          </div>
          <div className="stat-card text-center py-3">
            <p className="text-lg font-semibold">{percentual}%</p>
            <p className="stat-label">Progresso</p>
          </div>
        </div>

        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-success transition-all duration-300 rounded-full" style={{ width: `${Math.min(100, percentual)}%` }} />
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
            <Input
              ref={inputRef}
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Bipar IMEI, nº da OS ou nome do cliente..."
              className="pl-9 h-11 text-base"
              autoFocus
            />
          </div>
          <Button onClick={handleScan} className="h-11 px-6">Bipar</Button>
          <Button variant="outline" onClick={() => setFase("resultado")} className="h-11 gap-1.5">
            <Square className="h-3.5 w-3.5" /> Finalizar
          </Button>
        </div>

        <div className="section-card">
          <div className="section-header">
            <h3 className="section-title">Aparelhos ({itens.length})</h3>
            <span className="text-xs text-muted-foreground">{encontrados} conferidos</span>
          </div>
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {itens.map((item, idx) => (
              <div key={idx} className={cn(
                "flex items-center justify-between px-4 py-2.5",
                item.encontrado && "bg-success/5",
              )}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">OS #{item.os_numero} — {item.aparelho}</p>
                  <p className="text-[10px] text-muted-foreground">{item.cliente_nome}{item.imei ? ` · IMEI: ${item.imei}` : ""}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {item.encontrado ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <button
                      onClick={() => {
                        setItens(prev => {
                          const updated = [...prev];
                          updated[idx] = { ...updated[idx], encontrado: true };
                          return updated;
                        });
                      }}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Marcar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {extras.length > 0 && (
          <div className="section-card border-destructive/30">
            <div className="section-header">
              <h3 className="section-title text-destructive">Itens extras / não identificados ({extras.length})</h3>
            </div>
            <div className="p-4 space-y-1">
              {extras.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <X className="h-3.5 w-3.5 text-destructive" />
                  <span className="font-mono text-xs">{e}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // RESULTADO
  return (
    <div className="space-y-4">
      <div className="section-card">
        <div className="section-header">
          <h3 className="section-title">Resultado da Conferência</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-2xl font-semibold text-success">{encontrados}</p>
              <p className="text-xs text-muted-foreground">Encontrados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-destructive">{faltando}</p>
              <p className="text-xs text-muted-foreground">Faltando</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-warning">{extras.length}</p>
              <p className="text-xs text-muted-foreground">Extras</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold">{percentual}%</p>
              <p className="text-xs text-muted-foreground">Conferido</p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Responsável: <strong>{responsavel}</strong>
          </div>

          {faltando > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-destructive">Aparelhos não encontrados</h4>
              <div className="divide-y border rounded-lg">
                {itens.filter(i => !i.encontrado).map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span>OS #{item.os_numero} — {item.aparelho}</span>
                    <span className="text-muted-foreground">{item.cliente_nome}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {extras.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-warning">Itens extras ({extras.length})</h4>
              <div className="text-sm text-muted-foreground">{extras.join(", ")}</div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button onClick={() => salvarMutation.mutate()} disabled={salvarMutation.isPending} className="gap-1.5">
              <ClipboardList className="h-4 w-4" />
              {salvarMutation.isPending ? "Salvando..." : "Salvar Conferência"}
            </Button>
            <Button variant="outline" onClick={() => { setFase("config"); setItens([]); setExtras([]); setResponsavel(""); }}>
              Nova Conferência
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
