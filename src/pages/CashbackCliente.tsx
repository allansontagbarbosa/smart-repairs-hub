import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Check, Loader2, AlertTriangle, History, Info } from "lucide-react";

const fmtC = (c?: number | null) => formatCurrency((c ?? 0) / 100);
const fmtDate = (s?: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "");

const categoriaEmoji: Record<string, string> = {
  tela: "📱", bateria: "🔋", camera: "📷", audio: "🔉",
  biometria: "👆", botoes: "🔘", conector: "🔌", fisico: "🛠️",
  geral: "📦", software: "💾", sem_categoria: "❓",
};

type TipoTaxa = "nenhum" | "percentual" | "valor_fixo" | "percentual_lucro";

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
  const hasLucroRule = (data?.categorias ?? []).some((c: any) => c.tipo_taxa === "percentual_lucro");

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

      {hasLucroRule && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertTitle>Atenção: regra "percentual sobre LUCRO" ativa</AlertTitle>
          <AlertDescription>
            OS com lucro ≤ 0 (após peças, custo operacional e comissão) ficam <b>bloqueadas</b> ao tentar mudar para "pronto".
            Configure o custo operacional em <a href="/configuracoes/cashback/custo-operacional" className="underline">Configurações &gt; Cashback</a>.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Taxas por categoria de serviço</CardTitle>
          <p className="text-sm text-muted-foreground">
            Defina tipo de cashback, vigência opcional e, se desejar, aplique retroativamente nas OS do mês atual.
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
  const tipoAtual: TipoTaxa = cat.tem_taxa ? (cat.tipo_taxa as TipoTaxa) : "nenhum";
  const [tipo, setTipo] = useState<TipoTaxa>(tipoAtual);
  const valorInicial =
    cat.tipo_taxa === "valor_fixo"
      ? (cat.valor_fixo_centavos != null ? (Number(cat.valor_fixo_centavos) / 100).toFixed(2) : "")
      : (cat.percentual != null ? String(cat.percentual) : "");
  const [valor, setValor] = useState<string>(valorInicial);
  const [dataInicio, setDataInicio] = useState<string>(cat.data_inicio ?? "");
  const [dataFim, setDataFim] = useState<string>(cat.data_fim ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [dirty, setDirty] = useState(false);
  const [retroOpen, setRetroOpen] = useState(false);

  useEffect(() => {
    const nt: TipoTaxa = cat.tem_taxa ? (cat.tipo_taxa as TipoTaxa) : "nenhum";
    setTipo(nt);
    setValor(
      cat.tipo_taxa === "valor_fixo"
        ? (cat.valor_fixo_centavos != null ? (Number(cat.valor_fixo_centavos) / 100).toFixed(2) : "")
        : (cat.percentual != null ? String(cat.percentual) : "")
    );
    setDataInicio(cat.data_inicio ?? "");
    setDataFim(cat.data_fim ?? "");
    setDirty(false);
  }, [cat.tem_taxa, cat.tipo_taxa, cat.percentual, cat.valor_fixo_centavos, cat.data_inicio, cat.data_fim]);

  const salvar = async (novoTipo: TipoTaxa, novoValor: string, di: string, df: string) => {
    setStatus("saving");
    if (novoTipo === "nenhum") {
      const { error } = await supabase.rpc("cashback_set_taxa_categoria" as any, {
        p_cliente_id: clienteId, p_categoria: cat.categoria,
        p_tipo_taxa: "remover", p_percentual: null, p_valor_fixo_centavos: null,
        p_data_inicio: null, p_data_fim: null,
      });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setStatus("idle"); return; }
    } else {
      const trimmed = novoValor.trim().replace(",", ".");
      const num = Number(trimmed);
      if (!trimmed || isNaN(num) || num <= 0) { setStatus("idle"); return; }
      const payload: any = {
        p_cliente_id: clienteId, p_categoria: cat.categoria, p_tipo_taxa: novoTipo,
        p_percentual: null, p_valor_fixo_centavos: null,
        p_data_inicio: di || null, p_data_fim: df || null,
      };
      if (novoTipo === "valor_fixo") {
        payload.p_valor_fixo_centavos = Math.round(num * 100);
      } else {
        if (num > 100) { toast({ title: "Máximo 100%", variant: "destructive" }); setStatus("idle"); return; }
        payload.p_percentual = num;
      }
      const { error } = await supabase.rpc("cashback_set_taxa_categoria" as any, payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setStatus("idle"); return; }
    }
    setStatus("saved");
    setDirty(false);
    qc.invalidateQueries({ queryKey: ["cashback-cliente", clienteId] });
    setTimeout(() => setStatus("idle"), 1500);
  };

  useEffect(() => {
    if (!dirty) return;
    if (tipo === "nenhum") return;
    const t = setTimeout(() => salvar(tipo, valor, dataInicio, dataFim), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, dataInicio, dataFim, dirty]);

  const handleTipoChange = (nt: string) => {
    const novo = nt as TipoTaxa;
    if (novo === tipo) return;
    setTipo(novo);
    if (novo === "nenhum") {
      setValor(""); setDataInicio(""); setDataFim("");
      salvar("nenhum", "", "", "");
    } else {
      setValor(""); setDirty(false);
    }
  };

  const isPct = tipo === "percentual" || tipo === "percentual_lucro";
  const isFixo = tipo === "valor_fixo";
  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const inicioNoPassado = !!dataInicio && dataInicio < hoje;
  const semVencimento = cat.tem_taxa && !cat.data_inicio && !cat.data_fim;

  return (
    <div className="p-3 border rounded space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-xl w-8">{categoriaEmoji[cat.categoria] ?? "🔧"}</div>
        <div className="flex-1 min-w-[140px]">
          <div className="font-medium capitalize truncate">{cat.categoria.replace(/_/g, " ")}</div>
          <div className="text-xs text-muted-foreground">{cat.qtd_tipos_servico} tipos de serviço</div>
        </div>
        <Select value={tipo} onValueChange={handleTipoChange}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nenhum">Sem cashback</SelectItem>
            <SelectItem value="percentual">Percentual sobre valor</SelectItem>
            <SelectItem value="valor_fixo">Valor fixo (R$)</SelectItem>
            <SelectItem value="percentual_lucro">Percentual sobre LUCRO</SelectItem>
          </SelectContent>
        </Select>
        {tipo !== "nenhum" && (
          <div className="flex items-center gap-1">
            {isFixo && <span className="text-sm text-muted-foreground">R$</span>}
            <Input
              type="number" step="0.01" min={0} max={isPct ? 100 : undefined}
              value={valor}
              onChange={(e) => { setValor(e.target.value); setDirty(true); }}
              placeholder="—" className="w-24 text-right"
            />
            {isPct && <span className="text-sm text-muted-foreground">%</span>}
          </div>
        )}
        <div className="w-6">
          {status === "saving" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {status === "saved" && <Check className="w-4 h-4 text-emerald-600" />}
        </div>
        {cat.tem_taxa && (
          semVencimento
            ? <Badge variant="default" className="bg-emerald-600">sem vencimento</Badge>
            : <Badge variant="default" className="bg-amber-600">vigência limitada</Badge>
        )}
      </div>

      {tipo !== "nenhum" && (
        <div className="flex items-center gap-3 flex-wrap pl-11">
          <label className="text-xs text-muted-foreground flex items-center gap-2">
            Início:
            <Input type="date" className="w-[160px]" value={dataInicio}
              onChange={(e) => { setDataInicio(e.target.value); setDirty(true); }} />
          </label>
          <label className="text-xs text-muted-foreground flex items-center gap-2">
            Fim:
            <Input type="date" className="w-[160px]" value={dataFim}
              onChange={(e) => { setDataFim(e.target.value); setDirty(true); }} />
          </label>
          {cat.tem_taxa && inicioNoPassado && (
            <Button size="sm" variant="outline" onClick={() => setRetroOpen(true)}>
              <History className="w-4 h-4 mr-1" /> Aplicar retroativo
            </Button>
          )}
        </div>
      )}

      {inicioNoPassado && (
        <p className="pl-11 text-xs text-amber-600 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 mt-0.5" />
          Data de início no passado. Use "Aplicar retroativo" para creditar OS antigas do mês atual.
        </p>
      )}

      {cat.retroativo_aplicado_em && (
        <p className="pl-11 text-xs text-emerald-700 flex items-center gap-1">
          <Check className="w-3 h-3" />
          Retroativo aplicado em {new Date(cat.retroativo_aplicado_em).toLocaleDateString("pt-BR")} —
          {" "}{cat.retroativo_qtd_os ?? 0} OS · {fmtC(cat.retroativo_valor_total_centavos)}
        </p>
      )}

      {retroOpen && (
        <RetroativoDialog
          clienteId={clienteId}
          categoria={cat.categoria}
          onClose={() => setRetroOpen(false)}
          onApplied={() => {
            setRetroOpen(false);
            qc.invalidateQueries({ queryKey: ["cashback-cliente", clienteId] });
          }}
        />
      )}
    </div>
  );
}

function RetroativoDialog({ clienteId, categoria, onClose, onApplied }: {
  clienteId: string; categoria: string; onClose: () => void; onApplied: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [applying, setApplying] = useState(false);

  const { data: preview, isLoading } = useQuery({
    queryKey: ["cashback-retro-preview", clienteId, categoria],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cashback_preview_retroativo" as any, {
        p_cliente_id: clienteId, p_categoria: categoria,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const aplicar = async () => {
    setApplying(true);
    const { data, error } = await supabase.rpc("cashback_aplicar_retroativo" as any, {
      p_cliente_id: clienteId, p_categoria: categoria, p_confirmacao: true,
    });
    setApplying(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    const r: any = data;
    toast({ title: "Retroativo aplicado", description: `${r?.qtd_os_creditadas ?? 0} OS · ${fmtC(r?.valor_total_centavos)}` });
    onApplied();
  };

  const qtd = preview?.qtd_os_elegiveis ?? 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Aplicar retroativo · {categoria}</DialogTitle>
          <DialogDescription>
            Vai creditar OS prontas/entregues deste mês que ainda não receberam cashback.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? <Skeleton className="h-32" /> : preview?.erro ? (
          <Alert variant="destructive"><AlertDescription>{preview.erro}</AlertDescription></Alert>
        ) : (
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Período: </span>
              <b>{fmtDate(preview?.data_inicio_efetiva)} → {fmtDate(preview?.data_fim_efetiva)}</b>
            </div>
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="text-xs">
                O retroativo afeta apenas OS do <b>mês atual</b>. Meses anteriores nunca são alterados.
              </AlertDescription>
            </Alert>
            <div className="border rounded p-3 space-y-1">
              <p>✓ <b>{qtd}</b> OS elegíveis · <b>{fmtC(preview?.valor_total_centavos)}</b> em cashback</p>
              <p className="text-xs text-muted-foreground">
                {preview?.qtd_os_ja_creditadas ?? 0} já têm crédito (serão ignoradas) ·
                {" "}{preview?.qtd_os_que_pulariam ?? 0} sem valor/sem categoria
              </p>
            </div>
            {Array.isArray(preview?.amostra_primeiras_5) && preview.amostra_primeiras_5.length > 0 && (
              <div className="border rounded p-3">
                <p className="text-xs text-muted-foreground mb-2">Primeiras OS:</p>
                <ul className="text-xs space-y-1">
                  {preview.amostra_primeiras_5.map((os: any) => (
                    <li key={os.numero}>
                      OS #{os.numero} · {fmtDate(String(os.data_conclusao).slice(0,10))} ·
                      {" "}{formatCurrency(Number(os.valor_total ?? 0))} → +{fmtC(os.cashback_centavos)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {qtd > 0 && (
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(!!v)} />
                <span className="text-xs">
                  Entendo que isso vai criar <b>{qtd}</b> créditos novos no saldo do cliente.
                </span>
              </label>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={!confirm || qtd === 0 || applying} onClick={aplicar}>
            {applying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar retroativo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
