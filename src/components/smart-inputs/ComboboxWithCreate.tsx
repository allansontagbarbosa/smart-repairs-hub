import { useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

export interface ComboboxItem {
  id: string;
  nome: string;
}

interface Props {
  value: string;
  onChange: (id: string, nome: string) => void;
  items: ComboboxItem[];
  placeholder?: string;
  label?: string;
  entityName?: string; // ex: "marca", "modelo", "cor", "capacidade"
  onCreate?: (nome: string) => Promise<ComboboxItem | null>;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}

export function ComboboxWithCreate({
  value, onChange, items, placeholder = "Selecione...", label,
  entityName = "item", onCreate, disabled, disabledReason, className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = items.find((i) => i.id === value);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) => i.nome.toLowerCase().includes(q))
    : items;
  const exactMatch = q
    ? items.some((i) => i.nome.toLowerCase() === q)
    : false;
  const showCreate = !!onCreate && q.length > 0 && !exactMatch;

  const handleCreate = async () => {
    if (!onCreate || !search.trim() || creating) return;
    if (disabled) {
      if (disabledReason) toast.error(disabledReason);
      return;
    }
    setCreating(true);
    try {
      const created = await onCreate(search.trim());
      if (created) {
        onChange(created.id, created.nome);
        toast.success(`${capitalize(entityName)} cadastrad${entityName.endsWith("a") ? "a" : "o"}`);
        setSearch("");
        setOpen(false);
      }
    } catch (e: any) {
      toast.error(e?.message || `Erro ao cadastrar ${entityName}`);
    } finally {
      setCreating(false);
    }
  };

  const trigger = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn("w-full justify-between h-9 font-normal", !selected && "text-muted-foreground", className)}
    >
      <span className="truncate">{selected?.nome || placeholder}</span>
      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
    </Button>
  );

  return (
    <div className="space-y-1">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Buscar ${entityName}...`}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {filtered.length === 0 && !showCreate && (
                <CommandEmpty>Nenhum resultado.</CommandEmpty>
              )}
              {filtered.length > 0 && (
                <CommandGroup>
                  {filtered.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => {
                        onChange(item.id, item.nome);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === item.id ? "opacity-100" : "opacity-0")} />
                      {item.nome}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {showCreate && (
                <CommandGroup>
                  {disabled ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <CommandItem disabled className="text-muted-foreground opacity-60 cursor-not-allowed">
                              <Plus className="mr-2 h-4 w-4" />
                              Cadastrar "{search}" como {entityName}
                            </CommandItem>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{disabledReason}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <CommandItem
                      value={`__create__${search}`}
                      onSelect={handleCreate}
                      className="text-primary font-medium"
                      disabled={creating}
                    >
                      {creating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Cadastrar "{search}" como {entityName}
                    </CommandItem>
                  )}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
