import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const shortcuts = [
  { key: "N", desc: "Nova OS" },
  { key: "C", desc: "Novo Cliente" },
  { key: "F", desc: "Buscar na página" },
  { key: "Ctrl+K", desc: "Busca global" },
  { key: "Ctrl+P", desc: "Imprimir etiqueta" },
  { key: "ESC", desc: "Fechar dialog" },
  { key: "Alt+1", desc: "Dashboard" },
  { key: "Alt+2", desc: "Assistência" },
  { key: "Alt+3", desc: "Financeiro" },
  { key: "Alt+4", desc: "Peças" },
  { key: "Alt+5", desc: "Clientes" },
  { key: "Alt+6", desc: "Relatórios" },
  { key: "Alt+7", desc: "Configurações" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsHelp({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-muted-foreground">{s.desc}</span>
              <kbd className="ml-4 shrink-0 rounded border bg-muted px-2 py-0.5 text-xs font-mono">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
