import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ScanLine, Loader2, CheckCircle, AlertTriangle, XCircle, Trash2, Save, Package,
} from "lucide-react";

// ─── Shared helpers ───
function isValidImei(imei: string): boolean {
  const digits = imei.replace(/\D/g, "");
  if (digits.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = parseInt(digits[i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

function extractTac(imei: string): string {
  return imei.replace(/\D/g, "").slice(0, 8);
}

type RowStatus = "searching" | "found" | "not_found" | "duplicate" | "invalid" | "ready";

type BatchRow = {
  id: string;
  imei: string;
  marca: string;
  modelo: string;
  cor: string;
  capacidade: string;
  grade: string;
  custo: string;
  status: RowStatus;
  statusMsg: string;
  autoFields: Set<string>;
};

const grades = [
  { value: "seminovo_a", label: "Seminovo A" },
  { value: "seminovo_b", label: "Seminovo B" },
  { value: "seminovo_c", label: "Seminovo C" },
  { value: "novo", label: "Novo" },
  { value: "defeito", label: "Defeito" },
];

const gradeLabels: Record<string, string> = Object.fromEntries(grades.map(g => [g.value, g.label]));

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EntradaLoteDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanInput, setScanInput] = useState("");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [defaultGrade, setDefaultGrade] = useState("seminovo_a");
  const [defaultFornecedor, setDefaultFornecedor] = useState("");
  const [defaultLocalizacao, setDefaultLocalizacao] = useState("");

  // ─── Lookup a single IMEI ───
  const lookupImei = useCallback(async (imeiDigits: string): Promise<Partial<BatchRow>> => {
    if (!isValidImei(imeiDigits)) {
      return { status: "invalid", statusMsg: "IMEI inválido" };
    }

    // Check duplicates in estoque_aparelhos
    const { data: existing } = await supabase
      .from("estoque_aparelhos").select("marca, modelo, status").eq("imei", imeiDigits).limit(1);
    if (existing && existing.length > 0) {
      return { status: "duplicate", statusMsg: `Já cadastrado: ${existing[0].marca} ${existing[0].modelo}` };
    }

    // Check aparelhos (customer)
    const { data: custDev } = await supabase
      .from("aparelhos").select("marca, modelo").eq("imei", imeiDigits).limit(1);
    if (custDev && custDev.length > 0) {
      return { status: "duplicate", statusMsg: `Aparelho de cliente: ${custDev[0].marca} ${custDev[0].modelo}` };
    }

    // Check cache by TAC
    const tac = extractTac(imeiDigits);
    const { data: cached } = await supabase
      .from("imei_device_cache").select("*").eq("tac", tac).order("vezes_usado", { ascending: false }).limit(1);

    if (cached && cached.length > 0) {
      const c = cached[0];
      const autoFields = new Set<string>();
      if (c.marca) autoFields.add("marca");
      if (c.modelo) autoFields.add("modelo");
      if (c.cor) autoFields.add("cor");
      if (c.capacidade) autoFields.add("capacidade");

      await supabase.from("imei_device_cache").update({ vezes_usado: (c.vezes_usado || 0) + 1 }).eq("id", c.id);

      return {
        marca: c.marca || "",
        modelo: c.modelo || "",
        cor: c.cor || "",
        capacidade: c.capacidade || "",
        status: "found",
        statusMsg: "Identificado",
        autoFields,
      };
    }

    return { status: "not_found", statusMsg: "Não encontrado" };
  }, []);

  // ─── Handle scan/paste ───
  const handleAddImei = useCallback(async (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 15);
    if (digits.length !== 15) {
      toast.error("IMEI deve ter 15 dígitos");
      return;
    }

    // Check if already in current batch
    if (rows.some(r => r.imei === digits)) {
      toast.warning("Este IMEI já está na lista");
      return;
    }

    const rowId = crypto.randomUUID();
    const placeholder: BatchRow = {
      id: rowId, imei: digits, marca: "", modelo: "", cor: "", capacidade: "",
      grade: defaultGrade, custo: "", status: "searching", statusMsg: "Consultando...",
      autoFields: new Set(),
    };

    setRows(prev => [...prev, placeholder]);

    try {
      const result = await lookupImei(digits);
      setRows(prev => prev.map(r => r.id === rowId ? {
        ...r,
        marca: result.marca ?? r.marca,
        modelo: result.modelo ?? r.modelo,
        cor: result.cor ?? r.cor,
        capacidade: result.capacidade ?? r.capacidade,
        status: result.status ?? "not_found",
        statusMsg: result.statusMsg ?? "",
        autoFields: result.autoFields ?? new Set(),
      } : r));
    } catch {
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, status: "not_found", statusMsg: "Erro na consulta" } : r));
    }
  }, [rows, defaultGrade, lookupImei]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = scanInput.trim();
      if (val) { handleAddImei(val); setScanInput(""); }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").trim();
    // Support pasting multiple IMEIs (newline or comma separated)
    const lines = text.split(/[\n,;]+/).map(l => l.trim().replace(/\D/g, "")).filter(l => l.length === 15);
    if (lines.length > 1) {
      e.preventDefault();
      setScanInput("");
      lines.forEach((l, i) => setTimeout(() => handleAddImei(l), i * 200));
      return;
    }
    // Single IMEI paste handled by onChange + Enter
  };

  const updateRow = (id: string, field: keyof BatchRow, value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      // Mark as ready if it has marca+modelo and isn't duplicate/invalid
      if (updated.status !== "duplicate" && updated.status !== "invalid" && updated.marca && updated.modelo) {
        updated.status = updated.status === "found" ? "found" : "ready";
      }
      return updated;
    }));
  };

  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  // ─── Save all ───
  const savableRows = rows.filter(r => r.status !== "duplicate" && r.status !== "invalid" && r.status !== "searching" && r.marca && r.modelo);
  const duplicateCount = rows.filter(r => r.status === "duplicate").length;
  const invalidCount = rows.filter(r => r.status === "invalid").length;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (savableRows.length === 0) throw new Error("Nenhum aparelho válido para salvar");

      const payloads = savableRows.map(r => ({
        imei: r.imei,
        marca: r.marca.trim(),
        modelo: r.modelo.trim(),
        cor: r.cor.trim() || null,
        capacidade: r.capacidade.trim() || null,
        custo_compra: r.custo ? parseFloat(r.custo) : null,
        fornecedor: defaultFornecedor.trim() || null,
        localizacao: defaultLocalizacao.trim() || null,
        observacoes: r.grade ? `Grade: ${gradeLabels[r.grade] || r.grade}` : null,
        status: "disponivel" as const,
      }));

      const { error } = await supabase.from("estoque_aparelhos").insert(payloads);
      if (error) throw error;

      // Save to cache for learning
      for (const r of savableRows) {
        if (r.imei.length >= 8 && r.marca && r.modelo) {
          try {
            await supabase.from("imei_device_cache").upsert({
              tac: extractTac(r.imei), marca: r.marca.trim(), modelo: r.modelo.trim(),
              cor: r.cor.trim() || null, capacidade: r.capacidade.trim() || null,
              fonte: "manual", vezes_usado: 1,
            }, { onConflict: "tac,marca,modelo" });
          } catch { /* silent */ }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque_aparelhos"] });
      toast.success(`${savableRows.length} aparelho(s) cadastrado(s) com sucesso!`);
      setRows([]);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const statusIcon = (s: RowStatus) => {
    switch (s) {
      case "searching": return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "found": return <CheckCircle className="h-4 w-4 text-success" />;
      case "not_found": return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "duplicate": return <XCircle className="h-4 w-4 text-destructive" />;
      case "invalid": return <XCircle className="h-4 w-4 text-destructive" />;
      case "ready": return <CheckCircle className="h-4 w-4 text-success" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            Entrada em Lote
            {rows.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {rows.length} bipado(s) · {savableRows.length} válido(s)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 space-y-4 flex-shrink-0">
          {/* Defaults row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Grade padrão</Label>
              <Select value={defaultGrade} onValueChange={setDefaultGrade}>
                <SelectTrigger className="h-8 mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {grades.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fornecedor (todos)</Label>
              <Input value={defaultFornecedor} onChange={e => setDefaultFornecedor(e.target.value)} className="h-8 mt-1 text-xs" placeholder="Opcional" />
            </div>
            <div>
              <Label className="text-xs">Localização (todos)</Label>
              <Input value={defaultLocalizacao} onChange={e => setDefaultLocalizacao(e.target.value)} className="h-8 mt-1 text-xs" placeholder="Prateleira..." />
            </div>
          </div>

          {/* Scanner input */}
          <div className="relative">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/60" />
            <Input
              ref={inputRef}
              value={scanInput}
              onChange={e => setScanInput(e.target.value.replace(/\D/g, "").slice(0, 15))}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Bipe ou cole IMEIs em sequência (Enter após cada um)"
              className="pl-10 h-11 text-base font-mono tracking-wider border-2 border-primary/30 focus:border-primary"
              autoFocus
              inputMode="numeric"
            />
            {scanInput.length > 0 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {scanInput.length}/15
              </span>
            )}
          </div>
        </div>

        {/* ─── Table ─── */}
        <div className="flex-1 overflow-auto px-6 pb-2 min-h-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ScanLine className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhum aparelho bipado ainda</p>
              <p className="text-xs mt-1">Bipe, cole ou digite IMEIs no campo acima</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background z-10">
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-2 w-8">#</th>
                  <th className="text-left py-2 pr-2">IMEI</th>
                  <th className="text-left py-2 pr-2">Marca</th>
                  <th className="text-left py-2 pr-2">Modelo</th>
                  <th className="text-left py-2 pr-2 hidden lg:table-cell">Cor</th>
                  <th className="text-left py-2 pr-2 hidden lg:table-cell">Capacidade</th>
                  <th className="text-left py-2 pr-2 hidden md:table-cell">Grade</th>
                  <th className="text-left py-2 pr-2 hidden md:table-cell">Custo</th>
                  <th className="text-center py-2 pr-2 w-10">Status</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const isDup = row.status === "duplicate" || row.status === "invalid";
                  return (
                    <tr key={row.id} className={cn("border-b last:border-0", isDup && "opacity-50 bg-destructive/5")}>
                      <td className="py-1.5 pr-2 text-xs text-muted-foreground">{idx + 1}</td>
                      <td className="py-1.5 pr-2 font-mono text-xs">{row.imei}</td>
                      <td className="py-1.5 pr-2">
                        <Input
                          value={row.marca}
                          onChange={e => updateRow(row.id, "marca", e.target.value)}
                          className={cn("h-7 text-xs", row.autoFields.has("marca") && "ring-1 ring-success/40 bg-success/5")}
                          disabled={isDup || row.status === "searching"}
                          placeholder="—"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          value={row.modelo}
                          onChange={e => updateRow(row.id, "modelo", e.target.value)}
                          className={cn("h-7 text-xs", row.autoFields.has("modelo") && "ring-1 ring-success/40 bg-success/5")}
                          disabled={isDup || row.status === "searching"}
                          placeholder="—"
                        />
                      </td>
                      <td className="py-1.5 pr-2 hidden lg:table-cell">
                        <Input
                          value={row.cor}
                          onChange={e => updateRow(row.id, "cor", e.target.value)}
                          className={cn("h-7 text-xs", row.autoFields.has("cor") && "ring-1 ring-success/40 bg-success/5")}
                          disabled={isDup || row.status === "searching"}
                          placeholder="—"
                        />
                      </td>
                      <td className="py-1.5 pr-2 hidden lg:table-cell">
                        <Input
                          value={row.capacidade}
                          onChange={e => updateRow(row.id, "capacidade", e.target.value)}
                          className={cn("h-7 text-xs", row.autoFields.has("capacidade") && "ring-1 ring-success/40 bg-success/5")}
                          disabled={isDup || row.status === "searching"}
                          placeholder="—"
                        />
                      </td>
                      <td className="py-1.5 pr-2 hidden md:table-cell">
                        <Select value={row.grade} onValueChange={v => updateRow(row.id, "grade", v)} disabled={isDup}>
                          <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {grades.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-1.5 pr-2 hidden md:table-cell">
                        <Input
                          type="number"
                          step="0.01"
                          value={row.custo}
                          onChange={e => updateRow(row.id, "custo", e.target.value)}
                          className="h-7 text-xs w-24"
                          disabled={isDup || row.status === "searching"}
                          placeholder="R$"
                        />
                      </td>
                      <td className="py-1.5 pr-2 text-center" title={row.statusMsg}>
                        {statusIcon(row.status)}
                      </td>
                      <td className="py-1.5">
                        <button onClick={() => removeRow(row.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ─── Footer ─── */}
        {rows.length > 0 && (
          <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between flex-shrink-0">
            <div className="text-xs text-muted-foreground space-x-3">
              <span className="text-success font-medium">{savableRows.length} válido(s)</span>
              {duplicateCount > 0 && <span className="text-destructive">{duplicateCount} duplicado(s)</span>}
              {invalidCount > 0 && <span className="text-destructive">{invalidCount} inválido(s)</span>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setRows([])}>
                Limpar tudo
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={saveMutation.isPending || savableRows.length === 0}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...</>
                ) : (
                  <><Save className="h-3.5 w-3.5" /> Salvar {savableRows.length} aparelho(s)</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
