import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Building, User, Store, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useMetas, EscopoMeta } from "@/hooks/useMetas";
import { MetaCard } from "@/components/metas/MetaCard";

const FILTROS: { id: EscopoMeta | "todas"; label: string; icon: any }[] = [
  { id: "todas", label: "Todas", icon: null },
  { id: "empresa", label: "Empresa", icon: Building },
  { id: "tecnico", label: "Técnicos", icon: User },
  { id: "loja", label: "Lojas", icon: Store },
];

export default function Metas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtro, setFiltro] = useState<EscopoMeta | "todas">((searchParams.get("escopo") as any) || "todas");

  const { data: metas = [], isLoading } = useMetas("ativa");

  const filtradas = useMemo(() => {
    if (filtro === "todas") return metas;
    return metas.filter(m => m.escopo === filtro);
  }, [metas, filtro]);

  const stats = useMemo(() => {
    let noAlvo = 0, emRisco = 0;
    for (const m of metas) {
      const s = m.progresso?.status_visual;
      if (s === "verde") noAlvo++;
      else if (s === "vermelho" || s === "amarelo") emRisco++;
    }
    return { ativas: metas.length, noAlvo, emRisco };
  }, [metas]);

  const setFiltroUrl = (f: EscopoMeta | "todas") => {
    setFiltro(f);
    const sp = new URLSearchParams(searchParams);
    f === "todas" ? sp.delete("escopo") : sp.set("escopo", f);
    setSearchParams(sp, { replace: true });
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <div>
            <h1 className="text-xl font-semibold">Metas</h1>
            <p className="text-xs text-muted-foreground">Acompanhe o progresso das metas ativas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/metas/historico">
              <History className="h-4 w-4 mr-1" />
              Histórico
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/metas/nova">
              <Plus className="h-4 w-4 mr-1" />
              Nova
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-2xl font-semibold">{stats.ativas}</div>
          <div className="text-[11px] text-muted-foreground">Ativas</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-2xl font-semibold text-primary">{stats.noAlvo}</div>
          <div className="text-[11px] text-muted-foreground">No alvo</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-2xl font-semibold text-red-700">{stats.emRisco}</div>
          <div className="text-[11px] text-muted-foreground">Em risco</div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTROS.map(f => {
          const ativo = filtro === f.id;
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => setFiltroUrl(f.id)}
              className={`shrink-0 px-3 py-1 rounded-full border text-xs flex items-center gap-1 transition-colors ${
                ativo ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
              }`}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {isLoading && <p className="text-sm text-muted-foreground col-span-full">Carregando metas...</p>}
        {!isLoading && filtradas.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-border p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {metas.length === 0 ? "Nenhuma meta ativa ainda." : "Nenhuma meta com este filtro."}
            </p>
            {metas.length === 0 && (
              <Button asChild size="sm">
                <Link to="/metas/nova">Criar primeira meta</Link>
              </Button>
            )}
          </div>
        )}
        {filtradas.map(m => <MetaCard key={m.id} meta={m} />)}
      </div>
    </div>
  );
}
