import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useTecnicoIdentidade } from "@/hooks/useTecnico";
import { useMeusServicosEmAndamento, useServicosDisponiveis } from "@/hooks/useServicosDisponiveis";
import { useMeusServicosAtribuidos } from "@/hooks/useMeusServicosAtribuidos";
import { useDevolverServicoAtribuido } from "@/hooks/useDevolverServicoAtribuido";
import { useConcluirServico, useIniciarServico, useSoltarServico } from "@/hooks/useServicoActions";
import { Bell, Clock, ExternalLink, Loader2, Play, RotateCcw, CheckCircle2, Search, Undo2 } from "lucide-react";
import { startOfDay, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";

const brl = (v: number | null | undefined) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

function aparelhoLabel(servico: any) {
  const ap = servico.ordens_de_servico?.aparelhos;
  return [ap?.marca, ap?.modelo, ap?.cor].filter(Boolean).join(" ") || "Aparelho não informado";
}

function prazoInfo(previsao: string | null | undefined) {
  if (!previsao) return { label: "Sem prazo", late: false, diasAtraso: 0 };
  const d = new Date(previsao);
  const hoje = startOfDay(new Date());
  const late = d.getTime() < hoje.getTime();
  const diasAtraso = late ? differenceInCalendarDays(hoje, d) : 0;
  return { label: d.toLocaleDateString("pt-BR"), late, diasAtraso };
}

function PrazoBadge({ previsao }: { previsao: string | null | undefined }) {
  const p = prazoInfo(previsao);
  if (p.late && p.diasAtraso > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <Clock className="h-3 w-3" /> Atrasado há {p.diasAtraso} {p.diasAtraso === 1 ? "dia" : "dias"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" /> Prazo: {p.label}
    </span>
  );
}

function tempoDesde(iso: string | null | undefined) {
  if (!iso) return "agora";
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ${min % 60}min`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export default function TecnicoOrdens() {
  const { data: identidade } = useTecnicoIdentidade();
  const { data: disponiveis = [], isLoading: loadingDisp } = useServicosDisponiveis(identidade?.empresa_id);
  const { data: andamento = [], isLoading: loadingAndamento } = useMeusServicosEmAndamento(identidade?.funcionario_id);
  const { data: atribuidos = [], isLoading: loadingAtrib } = useMeusServicosAtribuidos(identidade?.funcionario_id);
  const iniciar = useIniciarServico();
  const concluir = useConcluirServico();
  const soltar = useSoltarServico();
  const devolver = useDevolverServicoAtribuido();
  const [tab, setTab] = useState("disponiveis");
  const [busca, setBusca] = useState("");
  const [filtroPrio, setFiltroPrio] = useState<"todas" | "alta" | "urgente">("todas");

  // Pular automaticamente pra "Atribuídos" quando chegar uma atribuição nova (0 → >0)
  const [prevAtribCount, setPrevAtribCount] = useState(0);
  useEffect(() => {
    if (prevAtribCount === 0 && atribuidos.length > 0) {
      setTab("atribuidos");
    }
    setPrevAtribCount(atribuidos.length);
  }, [atribuidos.length, prevAtribCount]);

  const filtraServicos = (lista: any[]) => {
    const q = busca.toLowerCase().trim();
    return lista.filter((s) => {
      const os = s.ordens_de_servico;
      if (!os) return false;

      if (filtroPrio !== "todas") {
        if (filtroPrio === "alta" && !["alta", "urgente"].includes(os.prioridade)) return false;
        if (filtroPrio === "urgente" && os.prioridade !== "urgente") return false;
      }

      if (!q) return true;
      const numero = String(os.numero ?? "");
      const numeroFmt = (os.numero_formatado ?? "").toLowerCase();
      const nomeServico = (s.nome ?? "").toLowerCase();
      const aparelho = `${os.aparelhos?.marca ?? ""} ${os.aparelhos?.modelo ?? ""}`.toLowerCase();

      return numero.includes(q) || numeroFmt.includes(q) ||
             nomeServico.includes(q) || aparelho.includes(q);
    });
  };

  const disponiveisFiltrados = useMemo(() => filtraServicos(disponiveis), [disponiveis, busca, filtroPrio]);
  const andamentoFiltrados = useMemo(() => filtraServicos(andamento), [andamento, busca, filtroPrio]);
  const atribuidosFiltrados = useMemo(() => filtraServicos(atribuidos), [atribuidos, busca, filtroPrio]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Fila de Serviços</h1>
        <p className="text-sm text-muted-foreground">Pegue serviços disponíveis e acompanhe seus reparos em andamento.</p>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nº OS, serviço, aparelho..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { v: "todas", label: "Todas" },
            { v: "alta", label: "Alta+" },
            { v: "urgente", label: "Urgente" },
          ].map((p) => (
            <button
              key={p.v}
              type="button"
              onClick={() => setFiltroPrio(p.v as any)}
              className={cn(
                "px-3 py-1 rounded-full text-xs border transition-colors",
                filtroPrio === p.v
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="disponiveis">Disponíveis ({disponiveisFiltrados.length})</TabsTrigger>
          <TabsTrigger value="andamento">Em andamento ({andamentoFiltrados.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="disponiveis" className="space-y-2 pt-3">
          {loadingDisp ? (
            <Loading />
          ) : disponiveisFiltrados.length === 0 ? (
            <Empty text={busca || filtroPrio !== "todas" ? "Nenhum serviço corresponde ao filtro" : "Nenhum serviço disponível agora"} />
          ) : (
            disponiveisFiltrados.map((servico: any) => {
              const os = servico.ordens_de_servico;
              return (
                <Card key={servico.id}>
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">#{os?.numero_formatado || os?.numero}</span>
                          {os?.prioridade === "alta" || os?.prioridade === "urgente" ? <Badge variant="destructive" className="text-[10px]">Alta</Badge> : null}
                        </div>
                        <p className="text-sm font-semibold truncate">{aparelhoLabel(servico)}</p>
                        <p className="text-sm text-muted-foreground truncate">{servico.nome}</p>
                      </div>
                      <Button size="sm" onClick={() => iniciar.mutate(servico.id)} disabled={iniciar.isPending}>
                        {iniciar.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                        Pegar serviço
                      </Button>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <PrazoBadge previsao={os?.previsao_entrega} />
                      <span className="font-semibold text-warning">Comissão {brl(servico.comissao)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="andamento" className="space-y-2 pt-3">
          {loadingAndamento ? (
            <Loading />
          ) : andamentoFiltrados.length === 0 ? (
            <Empty text={busca || filtroPrio !== "todas" ? "Nenhum serviço corresponde ao filtro" : "Você não tem serviços em andamento"} />
          ) : (
            andamentoFiltrados.map((servico: any) => {
              const os = servico.ordens_de_servico;
              return (
                <Card key={servico.id}>
                  <CardContent className="p-3 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">#{os?.numero_formatado || os?.numero}</span>
                        {os?.prioridade === "alta" || os?.prioridade === "urgente" ? <Badge variant="destructive" className="text-[10px]">Alta</Badge> : null}
                        <PrazoBadge previsao={os?.previsao_entrega} />
                      </div>
                      <p className="text-sm font-semibold truncate">{aparelhoLabel(servico)}</p>
                      <p className="text-sm text-muted-foreground truncate">{servico.nome}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Iniciado há {tempoDesde(servico.iniciado_em)}</span>
                      <span className="font-semibold text-warning">Comissão {brl(servico.comissao)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button size="sm" onClick={() => concluir.mutate(servico.id)} disabled={concluir.isPending}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Concluir
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" disabled={soltar.isPending}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Soltar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Soltar serviço?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O serviço voltará para a fila de disponíveis e outro técnico poderá pegá-lo.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => soltar.mutate(servico.id)}>Confirmar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/tecnico/ordens/${os?.id}`}><ExternalLink className="h-3.5 w-3.5 mr-1" /> Detalhes</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Loading() {
  return <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>;
}

function Empty({ text }: { text: string }) {
  return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{text}</CardContent></Card>;
}
