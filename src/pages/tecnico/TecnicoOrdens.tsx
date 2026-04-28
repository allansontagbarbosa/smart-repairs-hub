import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useTecnicoIdentidade } from "@/hooks/useTecnico";
import { useMeusServicosEmAndamento, useServicosDisponiveis } from "@/hooks/useServicosDisponiveis";
import { useConcluirServico, useIniciarServico, useSoltarServico } from "@/hooks/useServicoActions";
import { Clock, ExternalLink, Loader2, Play, RotateCcw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const brl = (v: number | null | undefined) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

function aparelhoLabel(servico: any) {
  const ap = servico.ordens_de_servico?.aparelhos;
  return [ap?.marca, ap?.modelo, ap?.cor].filter(Boolean).join(" ") || "Aparelho não informado";
}

function prazoInfo(previsao: string | null | undefined) {
  if (!previsao) return { label: "Sem prazo", late: false };
  const d = new Date(previsao);
  const late = d.getTime() < new Date(new Date().toDateString()).getTime();
  return { label: d.toLocaleDateString("pt-BR"), late };
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
  const iniciar = useIniciarServico();
  const concluir = useConcluirServico();
  const soltar = useSoltarServico();
  const [tab, setTab] = useState("disponiveis");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Fila de Serviços</h1>
        <p className="text-sm text-muted-foreground">Pegue serviços disponíveis e acompanhe seus reparos em andamento.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="disponiveis">Disponíveis</TabsTrigger>
          <TabsTrigger value="andamento">Minhas em andamento</TabsTrigger>
        </TabsList>

        <TabsContent value="disponiveis" className="space-y-2 pt-3">
          {loadingDisp ? (
            <Loading />
          ) : disponiveis.length === 0 ? (
            <Empty text="Nenhum serviço disponível agora" />
          ) : (
            disponiveis.map((servico: any) => {
              const os = servico.ordens_de_servico;
              const prazo = prazoInfo(os?.previsao_entrega);
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
                      <span className={cn("inline-flex items-center gap-1", prazo.late ? "text-destructive font-medium" : "text-muted-foreground")}>
                        <Clock className="h-3 w-3" /> Prazo: {prazo.label}
                      </span>
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
          ) : andamento.length === 0 ? (
            <Empty text="Você não tem serviços em andamento" />
          ) : (
            andamento.map((servico: any) => {
              const os = servico.ordens_de_servico;
              return (
                <Card key={servico.id}>
                  <CardContent className="p-3 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">#{os?.numero_formatado || os?.numero}</span>
                        {os?.prioridade === "alta" || os?.prioridade === "urgente" ? <Badge variant="destructive" className="text-[10px]">Alta</Badge> : null}
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
