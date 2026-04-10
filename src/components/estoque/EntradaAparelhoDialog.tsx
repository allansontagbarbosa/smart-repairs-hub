import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ScanLine, Loader2, CheckCircle, AlertTriangle, XCircle, Search, Sparkles, RefreshCw, Wifi, WifiOff,
} from "lucide-react";
import {
  lookupImei as lookupImeiService,
  saveToImeiCache,
  type ImeiLookupStatus,
} from "@/services/imeiLookupService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusGrades = [
  { value: "novo", label: "Novo / Lacrado" },
  { value: "seminovo_a", label: "Seminovo A (excelente)" },
  { value: "seminovo_b", label: "Seminovo B (bom)" },
  { value: "seminovo_c", label: "Seminovo C (marcas de uso)" },
  { value: "defeito", label: "Com defeito" },
];

const statusConfig: Record<ImeiLookupStatus, { icon: any; color: string; borderColor: string; bgColor: string }> = {
  idle: { icon: null, color: "", borderColor: "", bgColor: "" },
  validating: { icon: Loader2, color: "text-primary", borderColor: "border-primary", bgColor: "bg-primary/5" },
  loading: { icon: Loader2, color: "text-primary", borderColor: "border-primary", bgColor: "bg-primary/5" },
  success: { icon: CheckCircle, color: "text-success", borderColor: "border-success", bgColor: "bg-success/5" },
  partial_success: { icon: CheckCircle, color: "text-success", borderColor: "border-success", bgColor: "bg-success/5" },
  not_found: { icon: AlertTriangle, color: "text-warning", borderColor: "border-warning", bgColor: "bg-warning/5" },
  duplicate: { icon: XCircle, color: "text-destructive", borderColor: "border-destructive", bgColor: "bg-destructive/5" },
  error: { icon: WifiOff, color: "text-destructive", borderColor: "border-destructive", bgColor: "bg-destructive/5" },
};

const statusMessages: Record<ImeiLookupStatus, string> = {
  idle: "",
  validating: "Validando IMEI...",
  loading: "Consultando IMEI via API...",
  success: "Aparelho identificado com sucesso",
  partial_success: "Aparelho parcialmente identificado — complete os campos faltantes",
  not_found: "IMEI não localizado na API — preencha manualmente",
  duplicate: "IMEI já cadastrado no sistema",
  error: "Erro de comunicação com a API",
};

export function EntradaAparelhoDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const imeiRef = useRef<HTMLInputElement>(null);
  const custoRef = useRef<HTMLInputElement>(null);

  const [imei, setImei] = useState("");
  const [lookupStatus, setLookupStatus] = useState<ImeiLookupStatus>("idle");
  const [lookupSource, setLookupSource] = useState<string>("");
  const [duplicateInfo, setDuplicateInfo] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [cor, setCor] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [grade, setGrade] = useState("seminovo_a");
  const [custoCompra, setCustoCompra] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (open) {
      setImei(""); setLookupStatus("idle"); setLookupSource(""); setDuplicateInfo(null);
      setAutoFilled(new Set()); setErrorMessage(null);
      setMarca(""); setModelo(""); setCor(""); setCapacidade("");
      setGrade("seminovo_a"); setCustoCompra(""); setFornecedor(""); setLocalizacao(""); setObservacoes("");
      setTimeout(() => imeiRef.current?.focus(), 100);
    }
  }, [open]);

  const doLookup = useCallback(async (imeiValue: string) => {
    const digits = imeiValue.replace(/\D/g, "");
    if (digits.length !== 15) return;

    setLookupStatus("loading");
    setErrorMessage(null);
    setDuplicateInfo(null);

    const result = await lookupImeiService(digits);

    setLookupStatus(result.status);
    setLookupSource(result.source || "");

    if (result.status === "duplicate") {
      setDuplicateInfo(result.duplicate?.info || result.message || "IMEI duplicado");
      return;
    }

    if (result.status === "error") {
      setErrorMessage(result.message || "Erro na consulta");
      toast.error(result.message || "Erro ao consultar IMEI");
      return;
    }

    const filled = new Set<string>();
    if (result.marca) { setMarca(result.marca); filled.add("marca"); }
    if (result.modelo) { setModelo(result.modelo); filled.add("modelo"); }
    if (result.cor) { setCor(result.cor); filled.add("cor"); }
    if (result.capacidade) { setCapacidade(result.capacidade); filled.add("capacidade"); }
    setAutoFilled(filled);

    if (result.status === "success" || result.status === "partial_success") {
      const sourceLabel = result.source === "api" ? "via API" : result.source === "cache" ? "via cache" : "via base TAC";
      toast.success(`Aparelho identificado ${sourceLabel}!`);
      setTimeout(() => custoRef.current?.focus(), 200);
    } else if (result.status === "not_found") {
      toast.info("IMEI não localizado. Preencha os dados manualmente.");
    }
  }, []);

  const handleImeiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 15);
    setImei(raw);
    if (raw.length < 15) {
      setLookupStatus("idle"); setDuplicateInfo(null); setAutoFilled(new Set()); setErrorMessage(null);
    }
    if (raw.length === 15) doLookup(raw);
  };

  const handleImeiPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 15);
    if (pasted.length === 15) { e.preventDefault(); setImei(pasted); doLookup(pasted); }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!marca.trim()) throw new Error("Informe a marca do aparelho");
      if (!modelo.trim()) throw new Error("Informe o modelo do aparelho");

      const payload = {
        imei: imei || null,
        marca: marca.trim(),
        modelo: modelo.trim(),
        cor: cor.trim() || null,
        capacidade: capacidade.trim() || null,
        custo_compra: custoCompra ? parseFloat(custoCompra) : null,
        fornecedor: fornecedor.trim() || null,
        localizacao: localizacao.trim() || null,
        observacoes: [grade ? `Grade: ${statusGrades.find(g => g.value === grade)?.label}` : null, observacoes.trim() || null].filter(Boolean).join(" | ") || null,
        status: "disponivel" as const,
      };

      const { error } = await supabase.from("estoque_aparelhos").insert(payload);
      if (error) throw error;

      if (imei) await saveToImeiCache(imei, marca, modelo, cor, capacidade);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque_aparelhos"] });
      toast.success("Aparelho cadastrado com sucesso!");
      setImei(""); setLookupStatus("idle"); setDuplicateInfo(null); setAutoFilled(new Set()); setErrorMessage(null);
      setMarca(""); setModelo(""); setCor(""); setCapacidade("");
      setGrade("seminovo_a"); setCustoCompra(""); setObservacoes("");
      setTimeout(() => imeiRef.current?.focus(), 100);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar aparelho"),
  });

  const isDuplicate = lookupStatus === "duplicate";
  const isLoading = lookupStatus === "loading" || lookupStatus === "validating";
  const sc = statusConfig[lookupStatus];
  const StatusIcon = sc.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ScanLine className="h-5 w-5 text-primary" />
            Entrada de Aparelho
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* ─── IMEI Field ─── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              IMEI do aparelho
              <span className="text-[10px] font-normal text-muted-foreground flex items-center gap-1">
                <Wifi className="h-3 w-3" /> Consulta via API
              </span>
            </Label>
            <div className="relative">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/60" />
              <Input
                ref={imeiRef}
                value={imei}
                onChange={handleImeiChange}
                onPaste={handleImeiPaste}
                placeholder="Bipe, cole ou digite o IMEI (15 dígitos)"
                className={cn(
                  "pl-10 h-12 text-lg font-mono tracking-wider border-2 transition-colors",
                  lookupStatus !== "idle" && sc.borderColor,
                  lookupStatus !== "idle" && sc.bgColor,
                )}
                autoFocus
                inputMode="numeric"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {StatusIcon && (
                  <StatusIcon className={cn("h-5 w-5", sc.color, isLoading && "animate-spin")} />
                )}
              </div>
            </div>

            {/* Status messages */}
            {lookupStatus !== "idle" && (
              <p className={cn("text-sm flex items-center gap-1.5", sc.color)}>
                {StatusIcon && <StatusIcon className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />}
                {statusMessages[lookupStatus]}
                {lookupSource && lookupStatus !== "duplicate" && lookupStatus !== "error" && (
                  <span className="text-[10px] text-muted-foreground ml-1">
                    ({lookupSource === "api" ? "API externa" : lookupSource === "cache" ? "cache local" : "base TAC"})
                  </span>
                )}
              </p>
            )}

            {/* Duplicate alert */}
            {isDuplicate && duplicateInfo && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" /> IMEI já cadastrado no sistema
                </p>
                <p className="text-xs text-destructive/80 mt-1">{duplicateInfo}</p>
              </div>
            )}

            {/* Error with retry */}
            {lookupStatus === "error" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-destructive">{errorMessage}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Você pode tentar novamente ou preencher manualmente</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="gap-1 shrink-0" onClick={() => doLookup(imei)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
                </Button>
              </div>
            )}

            {/* Digit counter & manual button */}
            {imei.length > 0 && imei.length < 15 && (
              <p className="text-xs text-muted-foreground">{15 - imei.length} dígitos restantes</p>
            )}
            {imei.length === 15 && (lookupStatus === "idle" || lookupStatus === "error" || lookupStatus === "not_found") && (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => doLookup(imei)}>
                <Search className="h-3.5 w-3.5" /> Consultar IMEI
              </Button>
            )}
          </div>

          {/* ─── Device Fields ─── */}
          {!isDuplicate && (
            <>
              <div className="h-px bg-border" />

              <div className="grid grid-cols-2 gap-3">
                <AutoField label="Marca *" autoFilled={autoFilled.has("marca")}>
                  <Input value={marca} onChange={e => { setMarca(e.target.value); setAutoFilled(prev => { const n = new Set(prev); n.delete("marca"); return n; }); }}
                    placeholder="Apple, Samsung..." className={cn("h-9", autoFilled.has("marca") && "ring-2 ring-success/30 bg-success/5")} />
                </AutoField>
                <AutoField label="Modelo *" autoFilled={autoFilled.has("modelo")}>
                  <Input value={modelo} onChange={e => { setModelo(e.target.value); setAutoFilled(prev => { const n = new Set(prev); n.delete("modelo"); return n; }); }}
                    placeholder="iPhone 14 Pro Max" className={cn("h-9", autoFilled.has("modelo") && "ring-2 ring-success/30 bg-success/5")} />
                </AutoField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <AutoField label="Cor" autoFilled={autoFilled.has("cor")}>
                  <Input value={cor} onChange={e => { setCor(e.target.value); setAutoFilled(prev => { const n = new Set(prev); n.delete("cor"); return n; }); }}
                    placeholder="Preto, Branco..." className={cn("h-9", autoFilled.has("cor") && "ring-2 ring-success/30 bg-success/5")} />
                </AutoField>
                <AutoField label="Capacidade" autoFilled={autoFilled.has("capacidade")}>
                  <Input value={capacidade} onChange={e => { setCapacidade(e.target.value); setAutoFilled(prev => { const n = new Set(prev); n.delete("capacidade"); return n; }); }}
                    placeholder="128GB, 256GB..." className={cn("h-9", autoFilled.has("capacidade") && "ring-2 ring-success/30 bg-success/5")} />
                </AutoField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Estado / Grade</Label>
                  <Select value={grade} onValueChange={setGrade}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{statusGrades.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Custo de compra (R$)</Label>
                  <Input ref={custoRef} type="number" step="0.01" value={custoCompra} onChange={e => setCustoCompra(e.target.value)} placeholder="0,00" className="h-9 mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Fornecedor</Label><Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" className="h-9 mt-1" /></div>
                <div><Label className="text-xs">Localização</Label><Input value={localizacao} onChange={e => setLocalizacao(e.target.value)} placeholder="Prateleira, gaveta..." className="h-9 mt-1" /></div>
              </div>

              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className="mt-1" placeholder="Informações adicionais" />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Fechar</Button>
                <Button type="button" className="flex-1 gap-1.5" disabled={saveMutation.isPending || !marca.trim() || !modelo.trim()} onClick={() => saveMutation.mutate()}>
                  {saveMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : <><CheckCircle className="h-4 w-4" /> Cadastrar Aparelho</>}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">Após salvar, o formulário limpa para a próxima entrada rápida</p>
            </>
          )}

          {isDuplicate && (
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setImei(""); setLookupStatus("idle"); setDuplicateInfo(null); setTimeout(() => imeiRef.current?.focus(), 100); }}>
                Limpar e tentar outro
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AutoField({ label, autoFilled, children }: { label: string; autoFilled: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Label className="text-xs">{label}</Label>
        {autoFilled && <span className="inline-flex items-center gap-0.5 text-[10px] text-success font-medium"><Sparkles className="h-3 w-3" /> API</span>}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
