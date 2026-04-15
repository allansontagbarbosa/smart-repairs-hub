import { useState, useRef, useCallback } from "react";
import { Upload, FileText, Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ImportItem {
  nome: string;
  preco: number | null;
  tipo: "servico" | "peca";
  codigo: string | null;
  selected: boolean;
}

type Step = "upload" | "processing" | "review";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportIADialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [items, setItems] = useState<ImportItem[]>([]);
  const [filterTipo, setFilterTipo] = useState<"all" | "servico" | "peca">("all");
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  const reset = () => {
    setStep("upload");
    setItems([]);
    setFilterTipo("all");
    setFileName("");
    setImporting(false);
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder('latin1');
    const raw = decoder.decode(bytes);

    const lines: string[] = [];

    // Método 1: captura blocos BT...ET (text blocks do PDF)
    const btBlocks = raw.matchAll(/BT([\s\S]{1,500}?)ET/g);
    for (const block of btBlocks) {
      const tjMatches = block[1].matchAll(/\(([^)]+)\)\s*Tj/g);
      for (const m of tjMatches) {
        const str = m[1].replace(/\\\d{3}/g, '').replace(/\\/g, '').trim();
        if (str.length > 1) lines.push(str);
      }
      const tfMatches = block[1].matchAll(/\[([^\]]+)\]\s*TJ/g);
      for (const m of tfMatches) {
        const str = m[1].replace(/\(([^)]*)\)/g, '$1').replace(/\s*-?\d+\s*/g, ' ').trim();
        if (str.length > 1) lines.push(str);
      }
    }

    // Método 2: fallback — captura qualquer (texto) legível
    if (lines.length < 5) {
      const matches = raw.matchAll(/\(([^)]{2,80})\)/g);
      for (const m of matches) {
        const str = m[1].replace(/\\/g, '').trim();
        if (str.length > 2 && /[A-Za-zÀ-ú0-9]/.test(str)) {
          lines.push(str);
        }
      }
    }

    return lines.join('\n');
  };

  const extractTextFromExcel = async (file: File): Promise<string> => {
    const XLSX = await import("xlsx");
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    let text = "";
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      text += csv + "\n";
    }
    return text;
  };

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setStep("processing");

    try {
      let text = "";
      const ext = file.name.toLowerCase();

      if (ext.endsWith(".pdf")) {
        text = await extractTextFromPDF(file);
      } else if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
        text = await extractTextFromExcel(file);
      } else {
        toast.error("Formato não suportado. Use PDF ou Excel (.xlsx)");
        setStep("upload");
        return;
      }

      if (!text.trim()) {
        toast.error("Não foi possível extrair texto do arquivo");
        setStep("upload");
        return;
      }

      const { data, error } = await supabase.functions.invoke("classificar-itens", {
        body: { texto: text },
      });

      if (error) {
        console.error("Edge function error:", error);
        toast.error("Erro ao processar arquivo com IA. Tente novamente.");
        setStep("upload");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setStep("upload");
        return;
      }

      const parsed = (data?.items || []).map((item: any) => ({
        nome: String(item.nome || "").trim(),
        preco: item.preco != null ? Number(item.preco) : null,
        tipo: item.tipo === "servico" ? "servico" as const : "peca" as const,
        codigo: item.codigo || null,
        selected: true,
      })).filter((item: ImportItem) => item.nome.length > 0);

      if (parsed.length === 0) {
        toast.error("Nenhum item encontrado no arquivo");
        setStep("upload");
        return;
      }

      setItems(parsed);
      setStep("review");
    } catch (err: any) {
      console.error("Import error:", err);
      toast.error("Erro ao processar arquivo: " + (err.message || "erro desconhecido"));
      setStep("upload");
    }
  }, []);

  const filtered = items.filter((i) => filterTipo === "all" || i.tipo === filterTipo);
  const selectedCount = items.filter((i) => i.selected).length;
  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => i.selected);

  const toggleAll = () => {
    const newVal = !allFilteredSelected;
    setItems((prev) =>
      prev.map((item) =>
        filterTipo === "all" || item.tipo === filterTipo
          ? { ...item, selected: newVal }
          : item
      )
    );
  };

  const toggleItem = (idx: number) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, selected: !item.selected } : item)));
  };

  const changeType = (idx: number, tipo: "servico" | "peca") => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, tipo } : item)));
  };

  const handleImport = async () => {
    const selected = items.filter((i) => i.selected);
    if (selected.length === 0) {
      toast.error("Selecione pelo menos um item");
      return;
    }

    setImporting(true);

    try {
      const servicos = selected.filter((i) => i.tipo === "servico");
      const pecas = selected.filter((i) => i.tipo === "peca");

      if (servicos.length > 0) {
        const payload = servicos.map((s) => ({
          nome: s.nome,
          valor_padrao: s.preco || 0,
          ativo: true,
        }));
        const { error } = await supabase.from("tipos_servico").insert(payload);
        if (error) {
          console.error("Error inserting servicos:", error);
          toast.error("Erro ao importar serviços: " + error.message);
          setImporting(false);
          return;
        }
      }

      if (pecas.length > 0) {
        const payload = pecas.map((p) => ({
          nome: p.nome,
          preco_padrao: p.preco || 0,
          custo: p.preco ? Math.round(p.preco * 0.6 * 100) / 100 : 0,
          sku: p.codigo || undefined,
          ativo: true,
        }));
        const { error } = await supabase.from("produtos_base").insert(payload as any);
        if (error) {
          console.error("Error inserting pecas:", error);
          toast.error("Erro ao importar peças: " + error.message);
          setImporting(false);
          return;
        }
      }

      qc.invalidateQueries({ queryKey: ["tipos_servico"] });
      qc.invalidateQueries({ queryKey: ["produtos_base"] });
      toast.success(`${servicos.length} serviço(s) e ${pecas.length} peça(s) importados com sucesso`);
      onOpenChange(false);
      reset();
    } catch (err: any) {
      toast.error("Erro na importação: " + (err.message || "erro desconhecido"));
    } finally {
      setImporting(false);
    }
  };

  const fmt = (v: number | null) =>
    v != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

  const stepIndicator = (
    <div className="flex items-center gap-2 mb-4 text-xs">
      {[
        { key: "upload", label: "Upload", icon: Upload },
        { key: "processing", label: "Processando IA", icon: Sparkles },
        { key: "review", label: "Revisar e importar", icon: CheckCircle2 },
      ].map(({ key, label, icon: Icon }, i) => {
        const isCurrent = step === key;
        const isPast =
          (key === "upload" && (step === "processing" || step === "review")) ||
          (key === "processing" && step === "review");
        return (
          <div key={key} className="flex items-center gap-1.5">
            {i > 0 && <div className={`w-6 h-px ${isPast || isCurrent ? "bg-primary" : "bg-border"}`} />}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isCurrent ? "bg-primary text-primary-foreground" : isPast ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="h-3 w-3" />
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar via IA
          </DialogTitle>
        </DialogHeader>

        {stepIndicator}

        {step === "upload" && (
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-sm">Arraste um arquivo ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-1">PDF ou Excel (.xlsx) com lista de produtos/serviços</p>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center py-12 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Analisando com IA...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Classificando itens de <span className="font-medium">{fileName}</span>
              </p>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{items.length} itens encontrados</Badge>
                <Badge variant="secondary">{selectedCount} selecionados</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Select value={filterTipo} onValueChange={(v) => setFilterTipo(v as any)}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="servico">Serviços</SelectItem>
                    <SelectItem value="peca">Peças</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr className="border-b">
                      <th className="p-2 w-8">
                        <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} />
                      </th>
                      <th className="text-left p-2 font-medium">Nome</th>
                      <th className="text-left p-2 font-medium w-24">Preço</th>
                      <th className="text-left p-2 font-medium w-28">Tipo</th>
                      <th className="text-left p-2 font-medium w-20 hidden sm:table-cell">Código</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, _filteredIdx) => {
                      const realIdx = items.indexOf(item);
                      return (
                        <tr key={realIdx} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-2">
                            <Checkbox checked={item.selected} onCheckedChange={() => toggleItem(realIdx)} />
                          </td>
                          <td className="p-2 font-medium text-xs">{item.nome}</td>
                          <td className="p-2 text-xs">{fmt(item.preco)}</td>
                          <td className="p-2">
                            <Select value={item.tipo} onValueChange={(v) => changeType(realIdx, v as any)}>
                              <SelectTrigger className="h-7 text-xs w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="servico">Serviço</SelectItem>
                                <SelectItem value="peca">Peça</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 text-xs text-muted-foreground hidden sm:table-cell">{item.codigo || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => { reset(); }}>
                Novo arquivo
              </Button>
              <Button size="sm" onClick={handleImport} disabled={importing || selectedCount === 0}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>Importar {selectedCount} selecionado(s)</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
