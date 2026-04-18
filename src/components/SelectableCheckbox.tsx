import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  allSelected: boolean;
  someSelected: boolean;
  onToggle: () => void;
}

export function HeaderCheckbox({ allSelected, someSelected, onToggle }: HeaderProps) {
  return (
    <CheckboxPrimitive.Root
      checked={allSelected || (someSelected ? "indeterminate" : false)}
      onCheckedChange={onToggle}
      aria-label="Selecionar todos"
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background",
        "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        {someSelected ? <Minus className="h-3 w-3" /> : <Check className="h-3 w-3" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

interface RowProps {
  checked: boolean;
  onToggle: (e: { shiftKey: boolean }) => void;
}

export function RowCheckbox({ checked, onToggle }: RowProps) {
  const lastShift = React.useRef(false);
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onClick={e => {
        e.stopPropagation();
        lastShift.current = (e as React.MouseEvent).shiftKey;
      }}
      onCheckedChange={() => onToggle({ shiftKey: lastShift.current })}
      aria-label="Selecionar linha"
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background",
        "data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="h-3 w-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
