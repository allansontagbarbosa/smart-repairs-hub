import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  WIDGETS_CATALOGO,
  CATEGORIAS,
  type Categoria,
  type WidgetMeta,
} from "@/lib/widgetsCatalogo";
import { Plus, Check } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  widgetsAtivos: string[];
  onAdd: (widget: WidgetMeta) => void;
}

export function WidgetSelectorDialog({ open, onClose, widgetsAtivos, onAdd }: Props) {
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<Categoria>("operacao");

  const widgetsDaCategoria = WIDGETS_CATALOGO.filter(
    (w) => w.categoria === categoriaSelecionada
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Adicionar widget ao painel</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[200px_1fr] gap-4 min-h-[420px]">
          {/* Sidebar de categorias */}
          <div className="space-y-1.5 border-r pr-3">
            {CATEGORIAS.map((cat) => {
              const total = WIDGETS_CATALOGO.filter((w) => w.categoria === cat.id).length;
              const ativos = WIDGETS_CATALOGO.filter(
                (w) => w.categoria === cat.id && widgetsAtivos.includes(w.id)
              ).length;
              const sel = categoriaSelecionada === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoriaSelecionada(cat.id)}
                  className={`w-full text-left p-3 rounded-lg transition flex items-center gap-2 ${
                    sel
                      ? "bg-[#00C896]/10 border-2 border-[#00C896]"
                      : "border-2 border-transparent hover:bg-muted"
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{cat.nome}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {ativos}/{total} usados
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Lista de widgets */}
          <div className="space-y-2 overflow-auto max-h-[460px] pr-1">
            {widgetsDaCategoria.map((w) => {
              const ativo = widgetsAtivos.includes(w.id);
              return (
                <div
                  key={w.id}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                >
                  <span className="text-2xl">{w.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{w.nome}</div>
                    <div className="text-xs text-muted-foreground">{w.descricao}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Padrão: {w.defaultW} col × {w.defaultH} lin
                    </div>
                  </div>
                  {ativo ? (
                    <span className="text-xs font-semibold text-[#00C896] flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Em uso
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => onAdd(w)}
                      className="bg-[#00C896] hover:bg-[#00b389] text-white"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
