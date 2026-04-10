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
  ScanLine, Loader2, CheckCircle, AlertTriangle, XCircle, Search, Sparkles,
} from "lucide-react";

type LookupStatus = "idle" | "searching" | "found" | "not_found" | "duplicate";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Validate IMEI using Luhn algorithm
function isValidImei(imei: string): boolean {
  const digits = imei.replace(/\D/g, "");
  if (digits.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = parseInt(digits[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function extractTac(imei: string): string {
  return imei.replace(/\D/g, "").slice(0, 8);
}

const statusGrades = [
  { value: "novo", label: "Novo / Lacrado" },
  { value: "seminovo_a", label: "Seminovo A (excelente)" },
  { value: "seminovo_b", label: "Seminovo B (bom)" },
  { value: "seminovo_c", label: "Seminovo C (marcas de uso)" },
  { value: "defeito", label: "Com defeito" },
];

export function EntradaAparelhoDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const imeiRef = useRef<HTMLInputElement>(null);
  const custoRef = useRef<HTMLInputElement>(null);

  // State
  const [imei, setImei] = useState("");
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [duplicateInfo, setDuplicateInfo] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());

  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [cor, setCor] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [grade, setGrade] = useState("seminovo_a");
  const [custoCompra, setCustoCompra] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Reset form on open
  useEffect(() => {
    if (open) {
      setImei("");
      setLookupStatus("idle");
      setDuplicateInfo(null);
      setAutoFilled(new Set());
      setMarca("");
      setModelo("");
      setCor("");
      setCapacidade("");
      setGrade("seminovo_a");
      setCustoCompra("");
      setFornecedor("");
      setLocalizacao("");
      setObservacoes("");
      setTimeout(() => imeiRef.current?.focus(), 100);
    }
  }, [open]);

  // IMEI lookup logic
  const lookupImei = useCallback(async (imeiValue: string) => {
    const digits = imeiValue.replace(/\D/g, "");
    if (digits.length !== 15) return;

    if (!isValidImei(digits)) {
      setLookupStatus("not_found");
      toast.error("IMEI inválido. Verifique o número digitado.");
      return;
    }

    setLookupStatus("searching");

    try {
      // 1. Check for duplicate in estoque_aparelhos
      const { data: existing } = await supabase
        .from("estoque_aparelhos")
        .select("id, marca, modelo, status")
        .eq("imei", digits)
        .limit(1);

      if (existing && existing.length > 0) {
        const dev = existing[0];
        setLookupStatus("duplicate");
        setDuplicateInfo(`${dev.marca} ${dev.modelo} — Status: ${dev.status}`);
        return;
      }

      // 2. Check aparelhos table (customer devices)
      const { data: custDevice } = await supabase
        .from("aparelhos")
        .select("id, marca, modelo, cor")
        .eq("imei", digits)
        .limit(1);

      if (custDevice && custDevice.length > 0) {
        const dev = custDevice[0];
        setLookupStatus("duplicate");
        setDuplicateInfo(`Aparelho de cliente: ${dev.marca} ${dev.modelo}`);
        return;
      }

      // 3. Check imei_device_cache by TAC
      const tac = extractTac(digits);
      const { data: cached } = await supabase
        .from("imei_device_cache")
        .select("*")
        .eq("tac", tac)
        .order("vezes_usado", { ascending: false })
        .limit(1);

      if (cached && cached.length > 0) {
        const c = cached[0];
        const filled = new Set<string>();
        if (c.marca) { setMarca(c.marca); filled.add("marca"); }
        if (c.modelo) { setModelo(c.modelo); filled.add("modelo"); }
        if (c.cor) { setCor(c.cor); filled.add("cor"); }
        if (c.capacidade) { setCapacidade(c.capacidade); filled.add("capacidade"); }
        setAutoFilled(filled);
        setLookupStatus("found");

        // Increment usage counter
        await supabase
          .from("imei_device_cache")
          .update({ vezes_usado: (c.vezes_usado || 0) + 1 })
          .eq("id", c.id);

        toast.success("Aparelho identificado automaticamente!");
        setTimeout(() => custoRef.current?.focus(), 200);
        return;
      }

      // 4. Not found — allow manual entry
      setLookupStatus("not_found");
      toast.info("IMEI não encontrado na base. Preencha os dados manualmente.");

    } catch (err) {
      console.error("IMEI lookup error:", err);
      setLookupStatus("not_found");
    }
  }, []);

  // Handle IMEI input — auto-trigger on 15 digits (scanner/paste)
  const handleImeiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 15);
    setImei(raw);
    setLookupStatus("idle");
    setDuplicateInfo(null);
    setAutoFilled(new Set());

    if (raw.length === 15) {
      lookupImei(raw);
    }
  };

  // Handle paste
  const handleImeiPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 15);
    if (pasted.length === 15) {
      e.preventDefault();
      setImei(pasted);
      lookupImei(pasted);
    }
  };

  // Save to cache for learning
  const saveToCache = async (tac: string) => {
    if (!marca || !modelo) return;
    try {
      await supabase.from("imei_device_cache").upsert(
        {
          tac,
          marca,
          modelo,
          cor: cor || null,
          capacidade: capacidade || null,
          fonte: "manual",
          vezes_usado: 1,
        },
        { onConflict: "tac,marca,modelo" }
      );
    } catch {
      // Silent fail for cache
    }
  };

  // Save mutation
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

      // Save to cache for learning
      if (imei && imei.length >= 8) {
        await saveToCache(extractTac(imei));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque_aparelhos"] });
      toast.success("Aparelho cadastrado com sucesso!");
      // Reset for next entry
      setImei("");
      setLookupStatus("idle");
      setDuplicateInfo(null);
      setAutoFilled(new Set());
      setMarca("");
      setModelo("");
      setCor("");
      setCapacidade("");
      setGrade("seminovo_a");
      setCustoCompra("");
      setObservacoes("");
      // Keep fornecedor and localizacao for batch entry
      setTimeout(() => imeiRef.current?.focus(), 100);
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao salvar aparelho");
    },
  });

  const isDuplicate = lookupStatus === "duplicate";

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
          {/* ─── IMEI Field (Hero) ─── */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">IMEI do aparelho</Label>
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
                  lookupStatus === "found" && "border-success bg-success/5",
                  lookupStatus === "duplicate" && "border-destructive bg-destructive/5",
                  lookupStatus === "not_found" && "border-warning bg-warning/5",
                  lookupStatus === "searching" && "border-primary bg-primary/5",
                )}
                autoFocus
                inputMode="numeric"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {lookupStatus === "searching" && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                {lookupStatus === "found" && <CheckCircle className="h-5 w-5 text-success" />}
                {lookupStatus === "not_found" && <AlertTriangle className="h-5 w-5 text-warning" />}
                {lookupStatus === "duplicate" && <XCircle className="h-5 w-5 text-destructive" />}
              </div>
            </div>

            {/* Status messages */}
            {lookupStatus === "searching" && (
              <p className="text-sm text-primary flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando IMEI...
              </p>
            )}
            {lookupStatus === "found" && (
              <p className="text-sm text-success flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" /> Aparelho identificado com sucesso
              </p>
            )}
            {lookupStatus === "not_found" && (
              <p className="text-sm text-warning flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> IMEI não encontrado — complete manualmente
              </p>
            )}
            {lookupStatus === "duplicate" && duplicateInfo && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" /> IMEI já cadastrado no sistema
                </p>
                <p className="text-xs text-destructive/80 mt-1">{duplicateInfo}</p>
              </div>
            )}

            {/* Manual lookup button */}
            {imei.length > 0 && imei.length < 15 && (
              <p className="text-xs text-muted-foreground">
                {15 - imei.length} dígitos restantes
              </p>
            )}
            {imei.length === 15 && lookupStatus === "idle" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => lookupImei(imei)}
              >
                <Search className="h-3.5 w-3.5" /> Consultar IMEI
              </Button>
            )}
          </div>

          {/* ─── Device Fields ─── */}
          {!isDuplicate && (
            <>
              <div className="h-px bg-border" />

              {/* Marca + Modelo */}
              <div className="grid grid-cols-2 gap-3">
                <FieldWithIndicator label="Marca *" autoFilled={autoFilled.has("marca")}>
                  <Input
                    value={marca}
                    onChange={e => { setMarca(e.target.value); setAutoFilled(prev => { const n = new Set(prev); n.delete("marca"); return n; }); }}
                    placeholder="Apple, Samsung..."
                    className={cn("h-9", autoFilled.has("marca") && "ring-2 ring-success/30 bg-success/5")}
                  />
                </FieldWithIndicator>
                <FieldWithIndicator label="Modelo *" autoFilled={autoFilled.has("modelo")}>
                  <Input
                    value={modelo}
                    onChange={e => { setModelo(e.target.value); setAutoFilled(prev => { const n = new Set(prev); n.delete("modelo"); return n; }); }}
                    placeholder="iPhone 14 Pro Max"
                    className={cn("h-9", autoFilled.has("modelo") && "ring-2 ring-success/30 bg-success/5")}
                  />
                </FieldWithIndicator>
              </div>

              {/* Cor + Capacidade */}
              <div className="grid grid-cols-2 gap-3">
                <FieldWithIndicator label="Cor" autoFilled={autoFilled.has("cor")}>
                  <Input
                    value={cor}
                    onChange={e => { setCor(e.target.value); setAutoFilled(prev => { const n = new Set(prev); n.delete("cor"); return n; }); }}
                    placeholder="Preto, Branco..."
                    className={cn("h-9", autoFilled.has("cor") && "ring-2 ring-success/30 bg-success/5")}
                  />
                </FieldWithIndicator>
                <FieldWithIndicator label="Capacidade" autoFilled={autoFilled.has("capacidade")}>
                  <Input
                    value={capacidade}
                    onChange={e => { setCapacidade(e.target.value); setAutoFilled(prev => { const n = new Set(prev); n.delete("capacidade"); return n; }); }}
                    placeholder="128GB, 256GB..."
                    className={cn("h-9", autoFilled.has("capacidade") && "ring-2 ring-success/30 bg-success/5")}
                  />
                </FieldWithIndicator>
              </div>

              {/* Grade + Custo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Estado / Grade</Label>
                  <Select value={grade} onValueChange={setGrade}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusGrades.map(g => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Custo de compra (R$)</Label>
                  <Input
                    ref={custoRef}
                    type="number"
                    step="0.01"
                    value={custoCompra}
                    onChange={e => setCustoCompra(e.target.value)}
                    placeholder="0,00"
                    className="h-9 mt-1"
                  />
                </div>
              </div>

              {/* Fornecedor + Localização */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Fornecedor</Label>
                  <Input
                    value={fornecedor}
                    onChange={e => setFornecedor(e.target.value)}
                    placeholder="Nome do fornecedor"
                    className="h-9 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Localização</Label>
                  <Input
                    value={localizacao}
                    onChange={e => setLocalizacao(e.target.value)}
                    placeholder="Prateleira, gaveta..."
                    className="h-9 mt-1"
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  rows={2}
                  className="mt-1"
                  placeholder="Informações adicionais"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  className="flex-1 gap-1.5"
                  disabled={saveMutation.isPending || !marca.trim() || !modelo.trim()}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
                  ) : (
                    <><CheckCircle className="h-4 w-4" /> Cadastrar Aparelho</>
                  )}
                </Button>
              </div>

              {/* Hint for batch mode */}
              <p className="text-[11px] text-muted-foreground text-center">
                Após salvar, o formulário limpa automaticamente para a próxima entrada rápida
              </p>
            </>
          )}

          {isDuplicate && (
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setImei("");
                  setLookupStatus("idle");
                  setDuplicateInfo(null);
                  setTimeout(() => imeiRef.current?.focus(), 100);
                }}
              >
                Limpar e tentar outro
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for auto-filled indicator
function FieldWithIndicator({ label, autoFilled, children }: {
  label: string;
  autoFilled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Label className="text-xs">{label}</Label>
        {autoFilled && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-success font-medium">
            <Sparkles className="h-3 w-3" /> auto
          </span>
        )}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
