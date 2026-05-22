import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";

const fmtC = (c?: number | null) => formatCurrency((c ?? 0) / 100);

const categoriaEmoji: Record<string, string> = {
  tela: "📱", bateria: "🔋", camera: "📷", audio: "🔉",
  biometria: "👆", botoes: "🔘", conector: "🔌", fisico: "🛠️",
  geral: "📦", software: "💾", sem_categoria: "❓",
};

type TipoTaxa = "percentual" | "valor_fixo";

export default function CashbackCliente() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [obs, setObs] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cashback-cliente", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cashback_get_cliente_config" as any, { p_cliente_id: id });
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (data?.ativacao?.observacoes) setObs(data.ativacao.observacoes);
  }, [data?.ativacao?.observacoes]);

  const toggleAtivo = useMutation({
    mutationFn: async (ativar: boolean) => {
      const { error } = await supabase.rpc("cashback_ativar_cliente" as any, {
        p_cliente_id: id, p_ativar: ativar, p_observacoes: obs || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashback-cliente", id] });
      toast({ title: "Atualizado" });
    },
  });

  if (isLoading) return <div className="container mx-auto p-6"><Skeleton className="h-96" /></div>;
  if (data?.erro) return <div className="container mx-auto p-6">Cliente não encontrado</div>;

  const ativo = !!data?.ativacao?.ativo;

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <Button variant="ghost" onClick={() => nav("/cashback")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-2xl">{data?.cliente?.nome}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {data?.cliente?.tipo_cliente}{data?.cliente?.grupo_nome ? ` · ${data.cliente.grupo_nome}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm">{ativo ? "Cashback ATIVO" : "Inativo"}</span>
              <Switch checked={ativo} onCheckedChange={(v) => toggleAtivo.mutate(v)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea placeholder="Observações (ex: negociação especial, ata 003/2026...)"
            value={obs} onChange={(e) => setObs(e.target.value)}
            onBlur={() => ativo && toggleAtivo.mutate(true)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Taxas por categoria de serviço</CardTitle>
          <p className="text-sm text-muted-foreground">
            Escolha percentual (%) ou valor fixo (R$) por categoria. Vazio = não ganha cashback.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(data?.categorias ?? []).map((cat: any) => (
              <TaxaCategoriaRow key={cat.categoria} clienteId={id!} cat={cat} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Saldo</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Disponível</p>
              <p className="text-2xl font-bold text-primary">{fmtC(data?.saldo?.centavos)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total recebido</p>
              <p className="text-xl font-medium text-emerald-600">{fmtC(data?.saldo?.total_recebido_centavos)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total usado</p>
              <p className="text-xl font-medium text-orange-600">{fmtC(data?.saldo?.total_usado_centavos)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TaxaCategoriaRow({ clienteId, cat }: { clienteId: string; cat: any }) {
  const qc = useQueryClient();
  const tipoAtual: TipoTaxa = (cat.tipo_taxa as TipoTaxa) ?? "percentual";
  const [tipo, setTipo] = useState<TipoTaxa>(tipoAtual);
  const valorInicial =
    cat.tipo_taxa === "valor_fixo"
      ? (cat.valor_fixo_centavos != null ? (Number(cat.valor_fixo_centavos) / 100).toFixed(2) : "")
      : (cat.percentual != null ? String(cat.percentual) : "");
  const [valor, setValor] = useState<string>(valorInicial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [pendingTipo, setPendingTipo] = useState<TipoTaxa | null>(null);

  useEffect(() => {
    setTipo((cat.tipo_taxa as TipoTaxa) ?? "percentual");
    setValor(
      cat.tipo_taxa === "valor_fixo"
        ? (cat.valor_fixo_centavos != null ? (Number(cat.valor_fixo_centavos) / 100).toFixed(2) : "")
        : (cat.percentual != null ? String(cat.percentual) : "")
    );
  }, [cat.tipo_taxa, cat.percentual, cat.valor_fixo_centavos]);

  // Verifica se há OS deste mês para a categoria (pra perguntar retroativo)
  const checkMesAtual = async (): Promise<boolean> => {
    const mesInicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: tipos } = await (supabase as any)
      .from("tipos_servico").select("id").eq("categoria", cat.categoria);
    const tiposIds = (tipos ?? []).map((t: any) => t.id);
    if (!tiposIds.length) return false;
    const { data: oss } = await (supabase as any)
      .from("ordens_de_servico").select("id")
      .eq("cliente_id", clienteId)
      .in("tipo_servico_id", tiposIds)
      .gte("data_conclusao", mesInicio)
      .in("status", ["pronto", "entregue"])
      .limit(1);
    return (oss ?? []).length > 0;
  };

  const salvar = async (novoTipo: TipoTaxa, novoValor: string) => {
    setStatus("saving");
    const trimmed = novoValor.trim();
    if (trimmed === "") {
      // remover
      const { error } = await supabase.rpc("cashback_set_taxa_categoria" as any, {
        p_cliente_id: clienteId, p_categoria: cat.categoria,
        p_tipo_taxa: "remover", p_percentual: null, p_valor_fixo_centavos: null,
      });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setStatus("idle"); return; }
    } else {
      const num = Number(trimmed.replace(",", "."));
      if (isNaN(num) || num <= 0) {
        toast({ title: "Valor inválido", variant: "destructive" }); setStatus("idle"); return;
      }
      if (novoTipo === "percentual") {
        if (num > 100) { toast({ title: "Máximo 100%", variant: "destructive" }); setStatus("idle"); return; }
        const { error } = await supabase.rpc("cashback_set_taxa_categoria" as any, {
          p_cliente_id: clienteId, p_categoria: cat.categoria,
          p_tipo_taxa: "percentual", p_percentual: num, p_valor_fixo_centavos: null,
        });
        if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setStatus("idle"); return; }
      } else {
        const centavos = Math.round(num * 100);
        const { error } = await supabase.rpc("cashback_set_taxa_categoria" as any, {
          p_cliente_id: clienteId, p_categoria: cat.categoria,
          p_tipo_taxa: "valor_fixo", p_percentual: null, p_valor_fixo_centavos: centavos,
        });
        if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setStatus("idle"); return; }
      }
    }
    setStatus("saved");
    qc.invalidateQueries({ queryKey: ["cashback-cliente", clienteId] });
    setTimeout(() => setStatus("idle"), 1500);
  };

  // Auto-save valor (debounce 800ms) quando muda
  useEffect(() => {
    const valorAnt =
      tipoAtual === "valor_fixo"
        ? (cat.valor_fixo_centavos != null ? (Number(cat.valor_fixo_centavos) / 100).toFixed(2) : "")
        : (cat.percentual != null ? String(cat.percentual) : "");
    if (valor === valorAnt && tipo === tipoAtual) return;
    if (tipo !== tipoAtual) return; // mudança de tipo é tratada à parte
    const t = setTimeout(() => salvar(tipo, valor), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  const handleTipoChange = async (novoTipo: string) => {
    const nt = novoTipo as TipoTaxa;
    if (nt === tipo) return;
    // se já tem taxa configurada e há OS no mês, perguntar retroativo
    if (cat.tem_taxa && (await checkMesAtual())) {
      setPendingTipo(nt);
      return;
    }
    setTipo(nt);
    setValor("");
  };

  const confirmarTipo = async (recalcular: boolean) => {
    const nt = pendingTipo!;
    setPendingTipo(null);
    setTipo(nt);
    setValor("");
    if (recalcular) {
      const mesStr = new Date().toISOString().slice(0, 7);
      const { error } = await supabase.rpc("cashback_recalcular_retroativo" as any, {
        p_cliente_id: clienteId, p_categoria: cat.categoria, p_mes_inicio: mesStr,
      });
      if (error) toast({ title: "Erro no recálculo", description: error.message, variant: "destructive" });
      else toast({ title: "Recálculo enfileirado — defina a nova taxa para aplicar" });
    }
  };

  const remover = async () => {
    setValor("");
    await salvar(tipo, "");
  };

  return (
    <>
      <div className="flex items-center gap-3 p-3 border rounded">
        <div className="text-xl w-8">{categoriaEmoji[cat.categoria] ?? "🔧"}</div>
        <div className="flex-1 min-w-0">
          <div className="font-medium capitalize truncate">{cat.categoria.replace(/_/g, " ")}</div>
          <div className="text-xs text-muted-foreground">{cat.qtd_tipos_servico} tipos de serviço</div>
        </div>
        <Select value={tipo} onValueChange={handleTipoChange}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="percentual">Percentual (%)</SelectItem>
            <SelectItem value="valor_fixo">Valor fixo (R$)</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          {tipo === "valor_fixo" && <span className="text-sm text-muted-foreground">R$</span>}
          <Input
            type="number" step="0.01" min={0}
            max={tipo === "percentual" ? 100 : undefined}
            value={valor} onChange={(e) => setValor(e.target.value)}
            placeholder="—" className="w-24 text-right"
          />
          {tipo === "percentual" && <span className="text-sm text-muted-foreground">%</span>}
        </div>
        <div className="w-6">
          {status === "saving" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {status === "saved" && <Check className="w-4 h-4 text-emerald-600" />}
        </div>
        {cat.tem_taxa && (
          <Button size="icon" variant="ghost" onClick={remover} title="Remover taxa">
            <X className="w-4 h-4" />
          </Button>
        )}
        {cat.tem_taxa && <Badge variant="default">ativa</Badge>}
      </div>

      <AlertDialog open={!!pendingTipo} onOpenChange={(o) => !o && setPendingTipo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar retroativo nas OS deste mês?</AlertDialogTitle>
            <AlertDialogDescription>
              Existem OS de <b>{cat.categoria}</b> concluídas neste mês. Você quer recalcular
              o cashback delas com a nova taxa? Por padrão, mudanças afetam apenas OS futuras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => confirmarTipo(false)}>Não, só futuras</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmarTipo(true)}>Sim, recalcular</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
