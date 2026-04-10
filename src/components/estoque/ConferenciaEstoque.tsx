import { useState, useRef } from "react";
import { ScanLine, Check, X, AlertTriangle, ClipboardList, Play, Square } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { EstoqueItem } from "@/hooks/useEstoque";

type ConferenciaItemState = {
  item_id: string;
  item_nome: string;
  item_tipo: string;
  quantidade_esperada: number;
  quantidade_contada: number;
  status: "pendente" | "conferido" | "divergente";
};

interface Props {
  itens: EstoqueItem[];
  conferencias: any[];
}

export function ConferenciaEstoque({ itens }: Props) {
  const [fase, setFase] = useState<"config" | "bipagem" | "resultado">("config");
  const [responsavel, setResponsavel] = useState("");
  const [itensConferencia, setItensConferencia] = useState<ConferenciaItemState[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [extrasEncontrados, setExtrasEncontrados] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const getItemName = (item: EstoqueItem) => {
    if (item.nome_personalizado) return item.nome_personalizado;
    const parts = [item.marcas?.nome, item.modelos?.nome, item.cor, item.capacidade].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Item sem nome";
  };

  const iniciarConferencia = () => {
    if (!responsavel.trim()) {
      toast.error("Informe o responsável pela conferência");
      return;
    }

    const items: ConferenciaItemState[] = itens.map(i => ({
      item_id: i.id,
      item_nome: getItemName(i),
      item_tipo: i.tipo_item,
      quantidade_esperada: i.quantidade,
      quantidade_contada: 0,
      status: "pendente" as const,
    }));

    setItensConferencia(items);
    setExtrasEncontrados([]);
    setFase("bipagem");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleScan = () => {
    const code = scanInput.trim();
    if (!code) return;

    const idx = itensConferencia.findIndex(i =>
      i.item_nome.toLowerCase().includes(code.toLowerCase())
    );

    if (idx >= 0) {
      setItensConferencia(prev => {
        const updated = [...prev];
        const item = { ...updated[idx] };
        item.quantidade_contada += 1;
        item.status = item.quantidade_contada >= item.quantidade_esperada ? "conferido" : "pendente";
        if (item.quantidade_contada > item.quantidade_esperada) item.status = "divergente";
        updated[idx] = item;
        return updated;
      });
      toast.success(`✓ ${itensConferencia[idx].item_nome}`);
    } else {
      setExtrasEncontrados(prev => [...prev, code]);
      toast.error(`Item "${code}" não encontrado no estoque esperado`);
    }

    setScanInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleScan(); }
  };

  const totalEsperado = itensConferencia.reduce((s, i) => s + i.quantidade_esperada, 0);
  const totalConferido = itensConferencia.reduce((s, i) => s + i.quantidade_contada, 0);
  const totalFaltando = Math.max(0, totalEsperado - totalConferido);
  const itensConferidosCount = itensConferencia.filter(i => i.status === "conferido").length;
  const itensDivergentes = itensConferencia.filter(i => i.quantidade_contada !== i.quantidade_esperada && i.quantidade_contada > 0);
  const itensFaltando = itensConferencia.filter(i => i.quantidade_contada === 0 && i.quantidade_esperada > 0);
  const percentual = totalEsperado > 0 ? Math.round((totalConferido / totalEsperado) * 100) : 0;

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const { data: conf, error: e1 } = await supabase
        .from("conferencias_estoque")
        .insert({
          tipo_conferencia: "pecas",
          responsavel,
          status: "finalizada" as any,
          data_inicio: new Date().toISOString(),
          data_fim: new Date().toISOString(),
        })
        .select()
        .single();
      if (e1) throw e1;

      const confItens = itensConferencia.map(i => ({
        conferencia_id: conf.id,
        estoque_item_id: i.item_id,
        item_nome: i.item_nome,
        item_tipo: i.item_tipo,
        quantidade_esperada: i.quantidade_esperada,
        quantidade_contada: i.quantidade_contada,
        divergencia: i.quantidade_contada - i.quantidade_esperada,
        status: i.quantidade_contada === i.quantidade_esperada ? "conferido" : "divergente",
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
          <h3 className="section-title">Conferência de Peças</h3>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Confira o estoque físico de peças e materiais internos.
          </p>
          <div>
            <label className="text-sm font-medium">Responsável *</label>
            <Input value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome do responsável" className="h-9 mt-1" />
          </div>
          <div className="text-sm text-muted-foreground">
            {itens.length} peças serão incluídas nesta conferência
          </div>
          <Button onClick={iniciarConferencia} className="w-full gap-2" disabled={itens.length === 0}>
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
            <p className="text-lg font-semibold">{totalEsperado}</p>
            <p className="stat-label">Esperado</p>
          </div>
          <div className="stat-card text-center py-3 border-success/20 bg-success-muted">
            <p className="text-lg font-semibold text-success">{totalConferido}</p>
            <p className="stat-label">Conferido</p>
          </div>
          <div className={cn("stat-card text-center py-3", totalFaltando > 0 && "border-warning/20 bg-warning-muted")}>
            <p className={cn("text-lg font-semibold", totalFaltando > 0 && "text-warning")}>{totalFaltando}</p>
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
              placeholder="Bipar nome da peça ou SKU..."
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
            <h3 className="section-title">Peças ({itensConferencia.length})</h3>
            <span className="text-xs text-muted-foreground">{itensConferidosCount} conferidas</span>
          </div>
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {itensConferencia.map((item, idx) => (
              <div key={idx} className={cn(
                "flex items-center justify-between px-4 py-2.5",
                item.status === "conferido" && "bg-success/5",
                item.status === "divergente" && "bg-destructive/5",
              )}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.item_nome}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className="text-sm tabular-nums">
                    <span className={cn("font-semibold", item.status === "conferido" && "text-success", item.status === "divergente" && "text-destructive")}>
                      {item.quantidade_contada}
                    </span>
                    <span className="text-muted-foreground">/{item.quantidade_esperada}</span>
                  </span>
                  {item.status === "conferido" && <Check className="h-4 w-4 text-success" />}
                  {item.status === "divergente" && <AlertTriangle className="h-4 w-4 text-destructive" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {extrasEncontrados.length > 0 && (
          <div className="section-card border-destructive/30">
            <div className="section-header">
              <h3 className="section-title text-destructive">Itens não identificados ({extrasEncontrados.length})</h3>
            </div>
            <div className="p-4 space-y-1">
              {extrasEncontrados.map((e, i) => (
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
    <div className="section-card">
      <div className="section-header">
        <h3 className="section-title">Resultado da Conferência</h3>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-2xl font-semibold text-success">{itensConferidosCount}</p>
            <p className="text-xs text-muted-foreground">Corretas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-destructive">{itensFaltando.length}</p>
            <p className="text-xs text-muted-foreground">Faltando</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-warning">{itensDivergentes.length}</p>
            <p className="text-xs text-muted-foreground">Divergências</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold">{percentual}%</p>
            <p className="text-xs text-muted-foreground">Conferido</p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          Responsável: <strong>{responsavel}</strong>
        </div>

        {(itensDivergentes.length > 0 || itensFaltando.length > 0) && (
          <div>
            <h4 className="text-sm font-semibold mb-2 text-destructive">Divergências encontradas</h4>
            <div className="divide-y border rounded-lg">
              {[...itensFaltando, ...itensDivergentes].map((item, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>{item.item_nome}</span>
                  <span>
                    Esperado: <strong>{item.quantidade_esperada}</strong> · Contado: <strong className="text-destructive">{item.quantidade_contada}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button onClick={() => salvarMutation.mutate()} disabled={salvarMutation.isPending} className="gap-1.5">
            <ClipboardList className="h-4 w-4" />
            {salvarMutation.isPending ? "Salvando..." : "Salvar Conferência"}
          </Button>
          <Button variant="outline" onClick={() => { setFase("config"); setItensConferencia([]); setExtrasEncontrados([]); setResponsavel(""); }}>
            Nova Conferência
          </Button>
        </div>
      </div>
    </div>
  );
}
