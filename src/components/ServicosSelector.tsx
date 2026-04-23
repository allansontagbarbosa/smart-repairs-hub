import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type ServicoSelecionado = {
  id: string;              // tipo_servico.id
  nome: string;
  categoria?: string;
  valor_mao_obra: number;
  comissao_padrao: number;
};

type Props = {
  value: ServicoSelecionado[];
  onChange: (servicos: ServicoSelecionado[]) => void;
  disabled?: boolean;
  /** rótulo da seção (ex.: "Serviços selecionados" / "Serviços vinculados") */
  label?: string;
  /** texto auxiliar exibido abaixo da lista */
  hint?: string;
};

export function ServicosSelector({
  value,
  onChange,
  disabled = false,
  label = "Serviços selecionados",
  hint,
}: Props) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);

  const { data: tiposServico = [] } = useQuery<any[]>({
    queryKey: ["tipos_servico_os"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_servico")
        .select("id, nome, categoria, valor_padrao, comissao_padrao, ativo")
        .eq("ativo", true)
        .order("categoria", { nullsFirst: false })
        .order("nome");
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        id: s.id,
        nome: s.nome,
        categoria: s.categoria || "geral",
        valor_mao_obra: Number(s.valor_padrao) || 0,
        comissao_padrao: Number(s.comissao_padrao) || 0,
      }));
    },
  });

  const filtrados = useMemo(() => {
    const selectedIds = new Set(value.map((d) => d.id));
    return tiposServico.filter(
      (d: any) =>
        !selectedIds.has(d.id) &&
        (!search ||
          d.nome.toLowerCase().includes(search.toLowerCase()) ||
          (d.categoria || "").toLowerCase().includes(search.toLowerCase()))
    );
  }, [tiposServico, search, value]);

  const adicionar = (d: any) => {
    onChange([
      ...value,
      {
        id: d.id,
        nome: d.nome,
        categoria: d.categoria,
        valor_mao_obra: Number(d.valor_mao_obra) || 0,
        comissao_padrao: Number(d.comissao_padrao) || 0,
      },
    ]);
    setSearch("");
    setFocused(false);
  };

  const remover = (id: string) => {
    onChange(value.filter((x) => x.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Label>
        {!disabled && (
          <button
            type="button"
            onClick={() => setFocused(true)}
            className="text-[11px] text-primary hover:underline font-medium"
          >
            + Adicionar serviço
          </button>
        )}
      </div>

      {focused && !disabled && (
        <div className="mb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar serviço pelo nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => setTimeout(() => setFocused(false), 200)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          {filtrados.length > 0 && (
            <div className="mt-1 max-h-40 overflow-y-auto rounded-md border divide-y bg-popover shadow-md">
              {filtrados.slice(0, 15).map((d: any) => (
                <button
                  key={d.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => adicionar(d)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50"
                >
                  <div>
                    <p className="text-sm">{d.nome}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{d.categoria}</p>
                  </div>
                  <span className="text-xs font-medium text-success">
                    R$ {Number(d.valor_mao_obra).toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {value.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
          Nenhum serviço selecionado.
        </div>
      ) : (
        <div className="rounded-md border divide-y">
          {value.map((d) => (
            <div key={d.id} className="px-3 py-2 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.nome}</p>
                <p className="text-[11px] text-muted-foreground">
                  {d.categoria && <span className="capitalize">{d.categoria}</span>}
                  {d.comissao_padrao > 0 && (
                    <> · comissão técnico R$ {d.comissao_padrao.toFixed(2)}</>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-end ml-3">
                <span className="text-sm font-medium">R$ {d.valor_mao_obra.toFixed(2)}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => remover(d.id)}
                    className={cn("text-[11px] text-destructive hover:underline mt-0.5")}
                  >
                    remover
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {hint && (
        <p className="text-[11px] text-muted-foreground mt-1.5">{hint}</p>
      )}
    </div>
  );
}
