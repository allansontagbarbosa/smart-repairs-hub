import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EditableComboProps {
  value: string;
  onValueChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  /** Persistir no catálogo quando usuário cria valor novo. Opcional. */
  onCreateNew?: (typed: string) => Promise<void> | void;
  emptyHint?: string;
  /** Rótulo do tipo do item (ex: "fornecedor", "marca"). Usado no CTA "+ Cadastrar novo {label}". */
  entityLabel?: string;
}

/**
 * Select editável: usuário escolhe da lista OU digita um valor novo.
 * Se onCreateNew for fornecedo, persiste no catálogo ao confirmar valor novo.
 * Mostra sempre uma linha "+ Cadastrar novo {entityLabel}" no rodapé da lista
 * (mesmo sem digitar) para tornar a ação descobrível.
 */
export function EditableCombo({
  value,
  onValueChange,
  options,
  placeholder = "Escolher ou digitar",
  disabled,
  onCreateNew,
  emptyHint,
  entityLabel,
}: EditableComboProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const typed = query.trim();
  const exactMatch = options.some((o) => o.toLowerCase() === typed.toLowerCase());
  const canCreate = typed.length > 0 && !exactMatch;
  const showAlwaysCta = !!entityLabel && typed.length === 0;

  const commitExisting = (v: string) => {
    onValueChange(v);
    setQuery("");
    setOpen(false);
  };

  const commitNew = async () => {
    if (!typed) return;
    onValueChange(typed);
    if (onCreateNew) await onCreateNew(typed);
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setTimeout(() => inputRef.current?.focus(), 30);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[--radix-popover-trigger-width] min-w-[240px]"
        align="start"
      >
        <div className="p-2 border-b">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite para filtrar ou criar…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (filtered.length === 1) commitExisting(filtered[0]);
                else if (canCreate) commitNew();
              }
            }}
            className="h-8"
          />
        </div>
        <div className="max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 && !canCreate && !showAlwaysCta && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {emptyHint || "Nenhum item"}
            </p>
          )}
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => commitExisting(opt)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted text-left"
            >
              <Check
                className={cn(
                  "h-3.5 w-3.5",
                  value === opt ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="truncate">{opt}</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={commitNew}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted text-left text-primary font-medium border-t mt-1 pt-2"
            >
              <Plus className="h-3.5 w-3.5" />
              Usar “{typed}”
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                salvar no catálogo
              </span>
            </button>
          )}
          {showAlwaysCta && !canCreate && (
            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted text-left text-primary font-medium border-t mt-1 pt-2"
            >
              <Plus className="h-3.5 w-3.5" />
              Cadastrar novo {entityLabel}
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                digite o nome
              </span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
