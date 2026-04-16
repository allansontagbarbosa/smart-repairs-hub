import { useState } from "react";
import { Check, X, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ChecklistStatus = "ok" | "defeito" | "nao_testado";

export interface ChecklistItem {
  key: string;
  label: string;
  status: ChecklistStatus;
  custom?: boolean;
}

export const DEFAULT_CHECKLIST_ITEMS: Omit<ChecklistItem, "status">[] = [
  { key: "liga", label: "Liga normalmente" },
  { key: "tela", label: "Tela (sem trinco, sem manchas)" },
  { key: "touch", label: "Touch responde" },
  { key: "biometria", label: "Face ID / Touch ID" },
  { key: "bateria", label: "Bateria (% informado pelo sistema)" },
  { key: "camera_traseira", label: "Câmera traseira" },
  { key: "camera_frontal", label: "Câmera frontal" },
  { key: "alto_falante", label: "Alto-falante / fone" },
  { key: "microfone", label: "Microfone" },
  { key: "botoes", label: "Botões (power, volume, mute)" },
  { key: "vibracao", label: "Vibração" },
  { key: "wifi_bluetooth", label: "Wi-Fi / Bluetooth" },
  { key: "conector_carga", label: "Conector de carga" },
];

interface Props {
  value: Record<string, ChecklistStatus>;
  onChange: (value: Record<string, ChecklistStatus>) => void;
  customItems?: { key: string; label: string }[];
  onCustomItemsChange?: (items: { key: string; label: string }[]) => void;
  readOnly?: boolean;
}

const STATUS_CONFIG: Record<ChecklistStatus, { label: string; icon: typeof Check; className: string }> = {
  ok: { label: "OK", icon: Check, className: "bg-success/15 text-success border-success/30 hover:bg-success/25" },
  defeito: { label: "Defeito", icon: X, className: "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25" },
  nao_testado: { label: "N/T", icon: Minus, className: "bg-muted text-muted-foreground border-border hover:bg-muted/80" },
};

const STATUS_ORDER: ChecklistStatus[] = ["nao_testado", "ok", "defeito"];

export function ChecklistEntrada({
  value, onChange, customItems = [], onCustomItemsChange, readOnly = false,
}: Props) {
  const [novoItem, setNovoItem] = useState("");

  const allItems = [
    ...DEFAULT_CHECKLIST_ITEMS,
    ...customItems.map(c => ({ ...c, custom: true })),
  ];

  function setStatus(key: string, status: ChecklistStatus) {
    if (readOnly) return;
    onChange({ ...value, [key]: status });
  }

  function cycleStatus(key: string) {
    const current = value[key] || "nao_testado";
    const idx = STATUS_ORDER.indexOf(current);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    setStatus(key, next);
  }

  function adicionarCustom() {
    const label = novoItem.trim();
    if (!label || !onCustomItemsChange) return;
    const key = `custom_${Date.now()}`;
    onCustomItemsChange([...customItems, { key, label }]);
    setStatus(key, "nao_testado");
    setNovoItem("");
  }

  function removerCustom(key: string) {
    if (!onCustomItemsChange) return;
    onCustomItemsChange(customItems.filter(c => c.key !== key));
    const next = { ...value };
    delete next[key];
    onChange(next);
  }

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {allItems.map((item) => {
          const status = (value[item.key] || "nao_testado") as ChecklistStatus;
          const cfg = STATUS_CONFIG[status];
          const Icon = cfg.icon;
          const isCustom = (item as any).custom;
          return (
            <div
              key={item.key}
              className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5"
            >
              <button
                type="button"
                onClick={() => cycleStatus(item.key)}
                disabled={readOnly}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wide transition-colors shrink-0 min-w-[58px] justify-center",
                  cfg.className,
                  readOnly && "cursor-default"
                )}
                title="Clique para alternar status"
              >
                <Icon className="h-3 w-3" />
                {cfg.label}
              </button>
              <span className="text-xs flex-1 truncate">{item.label}</span>
              {isCustom && !readOnly && (
                <button
                  type="button"
                  onClick={() => removerCustom(item.key)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  title="Remover item"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && onCustomItemsChange && (
        <div className="flex gap-1.5 pt-1">
          <Input
            value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)}
            placeholder="Adicionar item personalizado..."
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionarCustom();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={adicionarCustom}
            disabled={!novoItem.trim()}
            className="h-8 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
