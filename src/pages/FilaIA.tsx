import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Brain, Loader2, List, AlertTriangle, Clock, CheckCircle2,
  Package, User, Wrench, XCircle, ArrowRight, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Distribuicao = {
  os_id: string;
  os_numero: number;
  cliente: string;
  aparelho: string;
  defeitos: string[];
  prioridade: "critica" | "atencao" | "normal";
  tecnico_sugerido_id: string;
  tecnico_sugerido_nome: string;
  motivo: string;
  tempo_estimado_minutos: number;
  pecas_disponiveis: boolean;
  ordem_execucao: number;
};

type FilaResult = {
  distribuicao: Distribuicao[];
  alertas: string[];
  resumo: string;
};

async function fetchFilaData() {
  // 1. OS pendentes com dados do aparelho/cliente/defeitos
  const { data: osPendentes } = await supabase
    .from("ordens_de_servico")
    .select(`
      id, numero, status, data_entrada, previsao_entrega, prazo_vencido,
      funcionario_id, valor, defeito_relatado,
      aparelhos!inner ( marca, modelo, imei, capacidade, clientes!inner ( nome, telefone ) )
    `)
    .is("deleted_at", null)
    .not("status", "eq", "entregue")
    .order("data_entrada", { ascending: true });

  // 2. Serviços de cada OS
  const osIds = (osPendentes ?? []).map((o: any) => o.id);
  let defeitosMap: Record<string, string[]> = {};
  if (osIds.length > 0) {
    const { data: defeitos } = await supabase
      .from("os_servicos")
      .select("ordem_id, nome")
      .in("ordem_id", osIds);
    (defeitos ?? []).forEach((d: any) => {
      if (!defeitosMap[d.ordem_id]) defeitosMap[d.ordem_id] = [];
      defeitosMap[d.ordem_id].push(d.nome);
    });
  }

  const osMapped = (osPendentes ?? []).map((o: any) => ({
    id: o.id,
    numero: o.numero,
    status: o.status,
    data_entrada: o.data_entrada,
    previsao_entrega: o.previsao_entrega,
    prazo_vencido: o.prazo_vencido,
    funcionario_id: o.funcionario_id,
    valor: o.valor,
    cliente: o.aparelhos?.clientes?.nome ?? "—",
    aparelho: `${o.aparelhos?.marca ?? ""} ${o.aparelhos?.modelo ?? ""}`.trim(),
    defeitos: defeitosMap[o.id] ?? (o.defeito_relatado ? o.defeito_relatado.split("; ") : []),
  }));

  // 3. Técnicos ativos
  const { data: tecnicos } = await supabase
    .from("funcionarios")
    .select("id, nome, funcao, especialidade")
    .eq("ativo", true)
    .is("deleted_at", null)
    .order("nome");

  // 4. Histórico de tempos (OS entregues com conclusão)
  const { data: historico } = await supabase
    .from("ordens_de_servico")
    .select(`
      funcionario_id, data_entrada, data_conclusao,
      funcionarios!inner ( nome ),
      os_defeitos ( nome )
    `)
    .eq("status", "entregue")
    .not("data_conclusao", "is", null)
    .not("funcionario_id", "is", null);

  const historicoMap: Record<string, { tecnico: string; defeito: string; minutos: number }[]> = {};
  (historico ?? []).forEach((h: any) => {
    if (!h.data_conclusao || !h.data_entrada) return;
    const min = (new Date(h.data_conclusao).getTime() - new Date(h.data_entrada).getTime()) / 60000;
    const defeitos = h.os_defeitos ?? [];
    defeitos.forEach((d: any) => {
      const key = `${h.funcionario_id}_${d.nome}`;
      if (!historicoMap[key]) historicoMap[key] = [];
      historicoMap[key].push({
        tecnico: h.funcionarios?.nome ?? "",
        defeito: d.nome,
        minutos: min,
      });
    });
  });

  const historico_tempos = Object.entries(historicoMap).map(([, vals]) => ({
    tecnico_nome: vals[0]?.tecnico,
    tipo_defeito: vals[0]?.defeito,
    tempo_medio_minutos: Math.round(vals.reduce((a, b) => a + b.minutos, 0) / vals.length),
    total_reparos: vals.length,
  }));

  // 5. Estoque disponível
  const { data: estoque } = await supabase
    .from("estoque_itens")
    .select("id, nome_personalizado, tipo_item, quantidade, marca_id, modelo_id")
    .is("deleted_at", null)
    .gt("quantidade", 0);

  return {
    os_pendentes: osMapped,
    tecnicos: tecnicos ?? [],
    historico_tempos,
    estoque: (estoque ?? []).map((e: any) => ({
      nome: e.nome_personalizado ?? "Item",
      tipo: e.tipo_item,
      quantidade: e.quantidade,
    })),
  };
}

const prioBadge: Record<string, { label: string; className: string }> = {
  critica: { label: "Crítica", className: "bg-destructive text-destructive-foreground" },
  atencao: { label: "Atenção", className: "bg-warning text-warning-foreground" },
  normal: { label: "Normal", className: "bg-muted text-muted-foreground" },
};

export default function FilaIA() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<FilaResult | null>(null);
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const [confirmApply, setConfirmApply] = useState(false);

  const analisarMutation = useMutation({
    mutationFn: async () => {
      const payload = await fetchFilaData();
      if (!payload.os_pendentes.length) throw new Error("Nenhuma OS pendente encontrada.");
      if (!payload.tecnicos.length) throw new Error("Nenhum técnico ativo encontrado.");

      const { data, error } = await supabase.functions.invoke("fila-ia", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as FilaResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setIgnoredIds(new Set());
      toast.success("Análise concluída!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao analisar fila"),
  });

  const aplicarMutation = useMutation({
    mutationFn: async () => {
      if (!result) return;
      const toApply = result.distribuicao.filter(d => !ignoredIds.has(d.os_id));
      const promises = toApply.map(d =>
        supabase.from("ordens_de_servico")
          .update({ funcionario_id: d.tecnico_sugerido_id })
          .eq("id", d.os_id)
      );
      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      if (errors.length) throw new Error(`${errors.length} erros ao aplicar`);
      return toApply.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      queryClient.invalidateQueries({ queryKey: ["aparelhos_assistencia"] });
      toast.success(`Distribuição aplicada: ${count} OS atribuídas`);
      setConfirmApply(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activeDistribuicao = result?.distribuicao.filter(d => !ignoredIds.has(d.os_id)) ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="page-header !mb-0">
          <h1 className="page-title flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Fila Inteligente
          </h1>
          <p className="page-subtitle">Distribuição automática de OS com IA</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/assistencia"><List className="h-4 w-4 mr-1" /> Lista</Link>
          </Button>
          <Button
            size="sm"
            onClick={() => analisarMutation.mutate()}
            disabled={analisarMutation.isPending}
          >
            {analisarMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            Analisar com IA
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {analisarMutation.isPending && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-8 justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Analisando prioridades, estoque e histórico dos técnicos...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !analisarMutation.isPending && (
        <>
          {/* Resumo */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-start gap-2">
                <Brain className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm">{result.resumo}</p>
              </div>
            </CardContent>
          </Card>

          {/* Alertas */}
          {result.alertas.length > 0 && (
            <Card className="border-warning/30 bg-warning/5">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" /> Alertas
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 space-y-1">
                {result.alertas.map((a, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-warning mt-0.5">•</span> {a}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Ação aplicar */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {activeDistribuicao.length} OS para distribuir
              {ignoredIds.size > 0 && ` (${ignoredIds.size} ignoradas)`}
            </p>
            <Button
              size="sm"
              onClick={() => setConfirmApply(true)}
              disabled={activeDistribuicao.length === 0}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Aplicar distribuição
            </Button>
          </div>

          {/* Cards de distribuição */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {result.distribuicao
              .sort((a, b) => a.ordem_execucao - b.ordem_execucao)
              .map((d) => {
                const ignored = ignoredIds.has(d.os_id);
                const prio = prioBadge[d.prioridade] ?? prioBadge.normal;

                return (
                  <Card key={d.os_id} className={cn(
                    "transition-all",
                    ignored && "opacity-40",
                    d.prioridade === "critica" && !ignored && "border-destructive/40 ring-1 ring-destructive/20",
                  )}>
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              #{String(d.os_numero).padStart(3, "0")}
                            </span>
                            <Badge className={cn("text-[10px] px-1.5 py-0", prio.className)}>
                              {prio.label}
                            </Badge>
                            <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-semibold">
                              #{d.ordem_execucao}
                            </span>
                          </div>
                          <p className="text-sm font-medium mt-1">{d.cliente}</p>
                          <p className="text-xs text-muted-foreground">{d.aparelho}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setIgnoredIds(prev => {
                              const next = new Set(prev);
                              if (next.has(d.os_id)) next.delete(d.os_id);
                              else next.add(d.os_id);
                              return next;
                            });
                          }}
                        >
                          {ignored ? "Restaurar" : <><XCircle className="h-3 w-3 mr-1" /> Ignorar</>}
                        </Button>
                      </div>

                      {/* Defeitos */}
                      <div className="flex flex-wrap gap-1">
                        {d.defeitos.map((def, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] font-normal">
                            {def}
                          </Badge>
                        ))}
                      </div>

                      {/* Técnico sugerido */}
                      <div className="bg-muted/50 rounded-lg p-2.5 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-primary" />
                          <span className="text-sm font-medium">{d.tecnico_sugerido_nome}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{d.motivo}</p>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          <span>~{d.tempo_estimado_minutos} min</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Package className="h-3 w-3" />
                          <span className={d.pecas_disponiveis ? "text-success" : "text-destructive"}>
                            {d.pecas_disponiveis ? "Peças OK" : "Sem peças"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && !analisarMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Brain className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Clique em "Analisar com IA" para gerar a distribuição otimizada</p>
          </CardContent>
        </Card>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={confirmApply} onOpenChange={setConfirmApply}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar distribuição?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai atribuir {activeDistribuicao.length} OS aos técnicos sugeridos pela IA.
              As atribuições atuais serão sobrescritas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => aplicarMutation.mutate()}
              disabled={aplicarMutation.isPending}
            >
              {aplicarMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1" />
              )}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
