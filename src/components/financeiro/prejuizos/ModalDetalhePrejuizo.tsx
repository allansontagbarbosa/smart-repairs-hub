import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Prejuizo, TIPO_PREJUIZO_COR } from "@/types/prejuizo";
import { useDeletarPrejuizo } from "@/hooks/usePrejuizos";
import { cn } from "@/lib/utils";

const fmtBRL = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (s: string) => new Date(s).toLocaleDateString("pt-BR");

export function ModalDetalhePrejuizo({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data: prejuizo, isLoading } = useQuery({
    queryKey: ["prejuizo", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_prejuizos" as any, {
        p_data_inicio: null,
        p_data_fim: null,
        p_tipo: null,
        p_origem: null,
        p_limit: 1000,
        p_offset: 0,
      });
      if (error) throw error;
      const r = data as any;
      return (
        ((r?.prejuizos ?? []) as Prejuizo[]).find((p) => p.id === id) || null
      );
    },
  });
  const del = useDeletarPrejuizo();

  const handleDelete = async () => {
    if (
      !confirm(
        "Tem certeza que quer excluir este prejuízo? A movimentação financeira vinculada também será estornada."
      )
    )
      return;
    try {
      await del.mutateAsync(id);
      toast.success("Prejuízo excluído");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro");
    }
  };

  if (isLoading || !prejuizo) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-card text-card-foreground rounded-xl p-6 w-full max-w-md shadow-xl flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground rounded-xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 pb-3 border-b border-border">
          <h3 className="text-lg font-semibold">Detalhes do prejuízo</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-block px-2 py-0.5 rounded-full text-xs border",
                TIPO_PREJUIZO_COR[prejuizo.tipo]
              )}
            >
              {prejuizo.tipo_label}
            </span>
            <span className="text-xs text-muted-foreground">
              {prejuizo.origem === "manual"
                ? "Registro manual"
                : "Gerado automaticamente"}
            </span>
          </div>

          <div className="text-3xl font-semibold text-destructive">
            {fmtBRL(prejuizo.valor_centavos)}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Data do evento</div>
              <div>{fmtData(prejuizo.data_evento)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Registrado em</div>
              <div>{fmtData(prejuizo.created_at)}</div>
            </div>
            {prejuizo.created_by_nome && (
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground">Por</div>
                <div>{prejuizo.created_by_nome}</div>
              </div>
            )}
          </div>

          {prejuizo.descricao && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Descrição</div>
              <p className="text-sm">{prejuizo.descricao}</p>
            </div>
          )}

          {prejuizo.observacoes && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Observações
              </div>
              <p className="text-sm whitespace-pre-wrap">
                {prejuizo.observacoes}
              </p>
            </div>
          )}

          {(prejuizo.os_origem || prejuizo.os_retrabalho) && (
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">OSs vinculadas</div>
              {prejuizo.os_origem && (
                <Link
                  to={`/assistencia?os=${prejuizo.os_origem.id}`}
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  OS origem: #{prejuizo.os_origem.numero}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
              {prejuizo.os_retrabalho && (
                <Link
                  to={`/assistencia?os=${prejuizo.os_retrabalho.id}`}
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  OS retrabalho: #{prejuizo.os_retrabalho.numero}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-between p-6 pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={handleDelete}
            disabled={del.isPending}
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Excluir
          </Button>
          <Button type="button" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
