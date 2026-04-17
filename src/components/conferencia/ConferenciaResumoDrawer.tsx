import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertTriangle, XCircle, PlusCircle, FileDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type ResumoLinha = {
  /** Identificador (IMEI ou código de barras / sku) */
  codigo: string;
  /** Nome principal (cliente+aparelho ou nome da peça) */
  titulo: string;
  /** Texto secundário (status, qtd, divergência) */
  detalhe?: string;
};

export type ConferenciaResumo = {
  tipo: "aparelhos" | "pecas";
  titulo: string;
  conferidos: ResumoLinha[];
  divergencias: ResumoLinha[];
  naoEncontrados: ResumoLinha[];
  foraDoSistema: ResumoLinha[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  resumo: ConferenciaResumo | null;
  onSalvar: () => Promise<void> | void;
  salvando?: boolean;
};

export function ConferenciaResumoDrawer({ open, onClose, resumo, onSalvar, salvando }: Props) {
  const [exportando, setExportando] = useState(false);

  if (!resumo) return null;

  const total = resumo.conferidos.length + resumo.divergencias.length + resumo.naoEncontrados.length + resumo.foraDoSistema.length;

  const exportarPDF = async () => {
    setExportando(true);
    try {
      const win = window.open("", "_blank", "width=900,height=700");
      if (!win) { toast.error("Bloqueador de pop-up impediu a exportação"); return; }
      const dataStr = new Date().toLocaleString("pt-BR");
      const renderLista = (titulo: string, cor: string, linhas: ResumoLinha[]) => `
        <h2 style="color:${cor};margin-top:24px">${titulo} (${linhas.length})</h2>
        ${linhas.length === 0 ? '<p style="color:#888;font-style:italic">Nenhum item</p>' :
          `<table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:#f5f5f5"><th style="text-align:left;padding:6px;border-bottom:1px solid #ddd">Código</th><th style="text-align:left;padding:6px;border-bottom:1px solid #ddd">Item</th><th style="text-align:left;padding:6px;border-bottom:1px solid #ddd">Detalhe</th></tr></thead>
            <tbody>${linhas.map(l => `<tr><td style="padding:6px;border-bottom:1px solid #eee;font-family:monospace">${l.codigo}</td><td style="padding:6px;border-bottom:1px solid #eee">${l.titulo}</td><td style="padding:6px;border-bottom:1px solid #eee;color:#666">${l.detalhe ?? ""}</td></tr>`).join("")}</tbody>
          </table>`}`;
      win.document.write(`<!doctype html><html><head><title>${resumo.titulo}</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#222}h1{margin:0 0 4px}h2{margin:18px 0 8px;font-size:15px}.meta{color:#666;font-size:12px;margin-bottom:18px}.kpi{display:inline-block;margin-right:18px;font-size:13px}@media print{button{display:none}}</style></head><body>
        <h1>${resumo.titulo}</h1>
        <div class="meta">${dataStr}</div>
        <div>
          <span class="kpi">✅ Conferidos: <b>${resumo.conferidos.length}</b></span>
          <span class="kpi">⚠️ Divergências: <b>${resumo.divergencias.length}</b></span>
          <span class="kpi">❌ Não escaneados: <b>${resumo.naoEncontrados.length}</b></span>
          <span class="kpi">➕ Fora do sistema: <b>${resumo.foraDoSistema.length}</b></span>
        </div>
        ${renderLista("✅ Conferidos", "#16a34a", resumo.conferidos)}
        ${renderLista("⚠️ Divergências", "#d97706", resumo.divergencias)}
        ${renderLista("❌ Não escaneados (sumiu?)", "#dc2626", resumo.naoEncontrados)}
        ${renderLista("➕ Escaneados fora do sistema", "#6b7280", resumo.foraDoSistema)}
        <button onclick="window.print()" style="margin-top:24px;padding:8px 16px">Imprimir / PDF</button>
      </body></html>`);
      win.document.close();
      setTimeout(() => win.print(), 400);
    } finally {
      setExportando(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="p-5 border-b">
          <SheetTitle>{resumo.titulo}</SheetTitle>
          <p className="text-xs text-muted-foreground">{total} itens analisados</p>
        </SheetHeader>

        <div className="grid grid-cols-4 gap-2 px-5 py-4 border-b text-center">
          <Stat label="Conferidos" value={resumo.conferidos.length} icon={CheckCircle2} color="text-success" />
          <Stat label="Divergências" value={resumo.divergencias.length} icon={AlertTriangle} color="text-warning" />
          <Stat label="Sumiram" value={resumo.naoEncontrados.length} icon={XCircle} color="text-destructive" />
          <Stat label="Fora" value={resumo.foraDoSistema.length} icon={PlusCircle} color="text-muted-foreground" />
        </div>

        <ScrollArea className="flex-1 px-5">
          <div className="py-4 space-y-5">
            <Bloco titulo="Conferidos" icone={CheckCircle2} cor="text-success" linhas={resumo.conferidos} bg="bg-success/5" />
            <Bloco titulo="Divergências (status inesperado)" icone={AlertTriangle} cor="text-warning" linhas={resumo.divergencias} bg="bg-warning/5" />
            <Bloco titulo="Não escaneados (possível problema)" icone={XCircle} cor="text-destructive" linhas={resumo.naoEncontrados} bg="bg-destructive/5" />
            <Bloco titulo="Escaneados fora do sistema" icone={PlusCircle} cor="text-muted-foreground" linhas={resumo.foraDoSistema} bg="bg-muted/40" />
          </div>
        </ScrollArea>

        <div className="border-t p-4 flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={exportarPDF} disabled={exportando} className="gap-1.5">
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Relatório PDF
          </Button>
          <Button onClick={onSalvar} disabled={salvando} className="gap-1.5">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar conferência
          </Button>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="space-y-0.5">
      <Icon className={cn("h-4 w-4 mx-auto", color)} />
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}

function Bloco({ titulo, icone: Icone, cor, linhas, bg }: { titulo: string; icone: any; cor: string; linhas: ResumoLinha[]; bg: string }) {
  if (linhas.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icone className={cn("h-4 w-4", cor)} />
        <h3 className="text-sm font-semibold">{titulo}</h3>
        <Badge variant="secondary">{linhas.length}</Badge>
      </div>
      <div className={cn("rounded-lg overflow-hidden border", bg)}>
        {linhas.map((l, i) => (
          <div key={`${l.codigo}-${i}`} className={cn("px-3 py-2 text-sm flex items-start justify-between gap-3", i > 0 && "border-t border-border/40")}>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{l.titulo}</div>
              {l.detalhe && <div className="text-xs text-muted-foreground truncate">{l.detalhe}</div>}
            </div>
            <span className="font-mono text-xs text-muted-foreground shrink-0 mt-0.5">{l.codigo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
