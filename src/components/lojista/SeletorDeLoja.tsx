import { useLojistaContext } from "@/contexts/LojistaContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Store } from "lucide-react";

export function SeletorDeLoja() {
  const { tipo, grupoNome, lojas, lojaAtivaId, setLojaAtivaId } = useLojistaContext();

  if (tipo !== "grupo") return null;

  const value = lojaAtivaId ?? "todas";

  return (
    <Select value={value} onValueChange={(v) => setLojaAtivaId(v === "todas" ? null : v)}>
      <SelectTrigger className="h-9 w-[260px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todas">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <span className="truncate">{grupoNome} — Todas as lojas</span>
          </div>
        </SelectItem>
        {lojas.map(l => (
          <SelectItem key={l.id} value={l.id}>
            <div className="flex items-center gap-2">
              <Store className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{l.nome}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function BannerModoConsolidado() {
  const { modoConsolidado, lojas, grupoNome } = useLojistaContext();
  if (!modoConsolidado) return null;
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary flex items-center gap-2">
      <Building2 className="h-3.5 w-3.5 shrink-0" />
      <span>
        Visualizando dados de <strong>todas as {lojas.length} lojas</strong> do grupo {grupoNome}.
        Selecione uma loja específica acima para filtrar.
      </span>
    </div>
  );
}
