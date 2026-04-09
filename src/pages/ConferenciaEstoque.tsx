import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardCheck, Search, AlertTriangle, CheckCircle, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Aparelho = Database["public"]["Tables"]["estoque_aparelhos"]["Row"];

async function fetchDisponiveis() {
  const { data, error } = await supabase
    .from("estoque_aparelhos")
    .select("*")
    .in("status", ["disponivel", "em_assistencia", "em_transporte"])
    .order("marca");
  if (error) throw error;
  return data;
}

export default function ConferenciaEstoque() {
  const [started, setStarted] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const { data: aparelhos = [], isLoading } = useQuery({
    queryKey: ["estoque_aparelhos_conferencia"],
    queryFn: fetchDisponiveis,
  });

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => {
    setChecked(new Set());
    setStarted(false);
  };

  const filtered = useMemo(() => {
    if (!search) return aparelhos;
    const q = search.toLowerCase();
    return aparelhos.filter(
      (a) =>
        a.marca.toLowerCase().includes(q) ||
        a.modelo.toLowerCase().includes(q) ||
        (a.imei ?? "").toLowerCase().includes(q) ||
        (a.localizacao ?? "").toLowerCase().includes(q)
    );
  }, [aparelhos, search]);

  const found = aparelhos.filter((a) => checked.has(a.id));
  const missing = aparelhos.filter((a) => !checked.has(a.id));

  // Check for duplicate IMEIs
  const imeiCount = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const a of aparelhos) {
      if (a.imei) {
        if (!map[a.imei]) map[a.imei] = [];
        map[a.imei].push(`${a.marca} ${a.modelo}`);
      }
    }
    return Object.entries(map).filter(([, v]) => v.length > 1);
  }, [aparelhos]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!started) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <h1 className="page-title">Conferência de Estoque</h1>
          <p className="page-subtitle">Verifique fisicamente cada aparelho</p>
        </div>

        <div className="section-card p-6 md:p-8 text-center max-w-md mx-auto">
          <ClipboardCheck className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-1">Iniciar Conferência</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {aparelhos.length} aparelhos serão listados para conferência.
            Marque cada um conforme encontrar fisicamente.
          </p>
          <Button onClick={() => setStarted(true)} className="w-full">
            <ClipboardCheck className="h-4 w-4 mr-1.5" />
            Iniciar
          </Button>
        </div>

        {imeiCount.length > 0 && (
          <div className="max-w-md mx-auto rounded-lg border border-warning/25 bg-warning-muted p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <p className="text-sm font-medium">IMEIs duplicados encontrados</p>
            </div>
            <ul className="space-y-1">
              {imeiCount.map(([imei, devices]) => (
                <li key={imei} className="text-xs text-muted-foreground">
                  IMEI {imei}: {devices.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="page-header !mb-0">
          <h1 className="page-title">Conferência em Andamento</h1>
          <p className="page-subtitle">
            {checked.size} de {aparelhos.length} conferidos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Reiniciar
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-success transition-all duration-300 rounded-full"
          style={{ width: `${aparelhos.length ? (checked.size / aparelhos.length) * 100 : 0}%` }}
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card">
          <p className="stat-value">{aparelhos.length}</p>
          <p className="stat-label">Total esperado</p>
        </div>
        <div className="stat-card border-success/20 bg-success-muted">
          <p className="stat-value text-success">{found.length}</p>
          <p className="stat-label">Encontrados</p>
        </div>
        <div className={cn("stat-card", missing.length > 0 && checked.size > 0 ? "border-destructive/20 bg-destructive/5" : "")}>
          <p className={cn("stat-value", missing.length > 0 && checked.size > 0 ? "text-destructive" : "")}>{missing.length}</p>
          <p className="stat-label">Faltantes</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por IMEI, modelo, marca ou localização..."
          className="pl-9 h-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Duplicate warning */}
      {imeiCount.length > 0 && (
        <div className="rounded-lg border border-warning/25 bg-warning-muted px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <p className="text-sm">
              <span className="font-medium">{imeiCount.length} IMEI{imeiCount.length > 1 ? "s" : ""} duplicado{imeiCount.length > 1 ? "s" : ""}</span>
              <span className="text-muted-foreground"> — {imeiCount.map(([imei]) => imei).join(", ")}</span>
            </p>
          </div>
        </div>
      )}

      {/* Checklist */}
      <div className="section-card divide-y">
        {filtered.map((item) => {
          const isChecked = checked.has(item.id);
          return (
            <label
              key={item.id}
              className={cn(
                "flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors",
                isChecked ? "bg-success-muted/50" : "hover:bg-muted/40"
              )}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => toggle(item.id)}
              />
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", isChecked && "line-through text-muted-foreground")}>
                  {item.marca} {item.modelo}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[item.capacidade, item.cor, item.localizacao && `📍 ${item.localizacao}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground hidden sm:block">
                {item.imei ?? "Sem IMEI"}
              </span>
              {isChecked ? (
                <CheckCircle className="h-4 w-4 text-success shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground/30 shrink-0" />
              )}
            </label>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">Nenhum aparelho encontrado</p>
        )}
      </div>

      {/* Final result when all checked */}
      {checked.size === aparelhos.length && aparelhos.length > 0 && (
        <div className="rounded-lg border border-success/25 bg-success-muted p-5 text-center">
          <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
          <p className="font-semibold">Conferência concluída!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Todos os {aparelhos.length} aparelhos foram encontrados.
          </p>
        </div>
      )}
    </div>
  );
}
