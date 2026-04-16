import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export interface VinculoPeca {
  peca_id: string;
  nome: string;
  quantidade: number;
  obrigatoria: boolean;
  custo_unitario: number;
  estoque: number;
}

interface Props {
  servicoId: string | null;
  valorServico: number;
  value: VinculoPeca[];
  onChange: (vinculos: VinculoPeca[]) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function ServicoPecasSection({ servicoId, valorServico, value, onChange }: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [carregouInicial, setCarregouInicial] = useState(false);

  // Carrega peças disponíveis no estoque
  const { data: pecasEstoque = [] } = useQuery({
    queryKey: ["estoque_pecas_para_vinculo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_itens")
        .select("id, nome_personalizado, sku, custo_unitario, preco_venda, quantidade, marcas:marca_id ( nome ), modelos:modelo_id ( nome )")
        .eq("tipo_item", "peca")
        .is("deleted_at", null)
        .order("nome_personalizado", { nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Carrega vínculos existentes do serviço
  const { data: vinculosBD } = useQuery({
    queryKey: ["servico_pecas", servicoId],
    queryFn: async () => {
      if (!servicoId) return [];
      const { data, error } = await supabase
        .from("servico_pecas" as any)
        .select("peca_id, quantidade, obrigatoria, estoque_itens:peca_id ( id, nome_personalizado, sku, custo_unitario, quantidade, marcas:marca_id ( nome ), modelos:modelo_id ( nome ) )")
        .eq("servico_id", servicoId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!servicoId,
  });

  useEffect(() => {
    if (carregouInicial) return;
    if (!servicoId) { setCarregouInicial(true); return; }
    if (vinculosBD === undefined) return;
    const items: VinculoPeca[] = (vinculosBD as any[]).map((v) => {
      const p = v.estoque_itens;
      return {
        peca_id: v.peca_id,
        nome: getPecaNome(p),
        quantidade: Number(v.quantidade) || 1,
        obrigatoria: !!v.obrigatoria,
        custo_unitario: Number(p?.custo_unitario) || 0,
        estoque: Number(p?.quantidade) || 0,
      };
    });
    onChange(items);
    setCarregouInicial(true);
  }, [vinculosBD, servicoId, carregouInicial, onChange]);

  function getPecaNome(p: any) {
    if (!p) return "Peça";
    if (p.nome_personalizado) return p.nome_personalizado;
    const m = [p.marcas?.nome, p.modelos?.nome].filter(Boolean).join(" ");
    return m || `Peça ${p.sku || (p.id || "").slice(0, 6)}`;
  }

  const idsJaVinculados = new Set(value.map((v) => v.peca_id));
  const pecasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return pecasEstoque
      .filter((p: any) => !idsJaVinculados.has(p.id))
      .filter((p: any) => {
        if (!q) return true;
        const nome = getPecaNome(p).toLowerCase();
        return nome.includes(q) || (p.sku || "").toLowerCase().includes(q);
      })
      .slice(0, 30);
  }, [pecasEstoque, busca, value]);

  function addPeca(p: any) {
    onChange([
      ...value,
      {
        peca_id: p.id,
        nome: getPecaNome(p),
        quantidade: 1,
        obrigatoria: true,
        custo_unitario: Number(p.custo_unitario) || 0,
        estoque: Number(p.quantidade) || 0,
      },
    ]);
    setBusca("");
    setPopoverOpen(false);
  }

  function updateVinculo(peca_id: string, patch: Partial<VinculoPeca>) {
    onChange(value.map((v) => (v.peca_id === peca_id ? { ...v, ...patch } : v)));
  }

  function removeVinculo(peca_id: string) {
    onChange(value.filter((v) => v.peca_id !== peca_id));
  }

  const custoPecasObrig = value
    .filter((v) => v.obrigatoria)
    .reduce((s, v) => s + v.custo_unitario * v.quantidade, 0);
  const margem = valorServico - custoPecasObrig;
  const margemNegativa = valorServico > 0 && margem < 0;

  return (
    <div className="space-y-2 pt-2 border-t">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Peças utilizadas neste serviço</Label>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar peça
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[360px] p-0" align="end">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Buscar peça por nome ou SKU..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y">
              {pecasFiltradas.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-4">
                  Nenhuma peça encontrada
                </p>
              ) : (
                pecasFiltradas.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addPeca(p)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm truncate">{getPecaNome(p)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Custo {fmt(Number(p.custo_unitario) || 0)} · Estoque {p.quantidade}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-success ml-2 shrink-0">
                      {fmt(Number(p.preco_venda) || 0)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          Nenhuma peça vinculada. Peças vinculadas são sugeridas automaticamente ao adicionar este serviço em uma OS.
        </p>
      ) : (
        <div className="rounded-lg border divide-y">
          {value.map((v) => (
            <div key={v.peca_id} className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{v.nome}</p>
                <p className="text-[10px] text-muted-foreground">
                  Custo unit. {fmt(v.custo_unitario)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-[10px] text-muted-foreground">Qtd</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.5"
                  value={v.quantidade}
                  onChange={(e) =>
                    updateVinculo(v.peca_id, { quantidade: Math.max(0.01, Number(e.target.value) || 1) })
                  }
                  className="h-7 w-16 text-xs text-center"
                />
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={v.obrigatoria}
                  onCheckedChange={(c) => updateVinculo(v.peca_id, { obrigatoria: !!c })}
                />
                <span className="text-[10px] text-muted-foreground">Obrigatória</span>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => removeVinculo(v.peca_id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <div
          className={cn(
            "flex items-center justify-between text-xs px-3 py-2 rounded-md",
            margemNegativa ? "bg-destructive/10 text-destructive" : "bg-muted/40",
          )}
        >
          <span className="text-muted-foreground">
            Custo de peças obrigatórias: <strong className="text-foreground">{fmt(custoPecasObrig)}</strong>
          </span>
          <span className={cn("font-medium", margemNegativa && "flex items-center gap-1")}>
            {margemNegativa && <AlertTriangle className="h-3 w-3" />}
            Margem: {fmt(margem)}
          </span>
        </div>
      )}
      {margemNegativa && (
        <p className="text-[10px] text-destructive px-1">
          Atenção: valor do serviço menor que o custo das peças obrigatórias — operação dará prejuízo.
        </p>
      )}
    </div>
  );
}

// Helper para salvar vínculos (upsert atomicamente)
export async function saveServicoPecas(servicoId: string, vinculos: VinculoPeca[]) {
  // Remove os existentes que não estão mais na lista (delete + re-insert para simplicidade)
  const { error: delErr } = await supabase
    .from("servico_pecas" as any)
    .delete()
    .eq("servico_id", servicoId);
  if (delErr) throw delErr;

  if (vinculos.length === 0) return;

  const payload = vinculos.map((v) => ({
    servico_id: servicoId,
    peca_id: v.peca_id,
    quantidade: v.quantidade,
    obrigatoria: v.obrigatoria,
  }));
  const { error: insErr } = await supabase.from("servico_pecas" as any).insert(payload);
  if (insErr) throw insErr;
}
