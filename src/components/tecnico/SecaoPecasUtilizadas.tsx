import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Package, Plus, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  usePecasUtilizadasDaOS,
  usePecasDisponiveis,
  useAdicionarPecaNaOS,
  useRemoverPecaDaOS,
  type PecaDisponivel,
} from "@/hooks/useOsPecas";

interface SecaoPecasUtilizadasProps {
  ordemId: string;
  servicoAtualId?: string | null;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SecaoPecasUtilizadas({ ordemId, servicoAtualId }: SecaoPecasUtilizadasProps) {
  const { data: pecas = [], isLoading } = usePecasUtilizadasDaOS(ordemId);
  const remover = useRemoverPecaDaOS();
  const [modalAberto, setModalAberto] = useState(false);

  const handleRemover = (id: string, nomePeca: string) => {
    if (!window.confirm(`Remover "${nomePeca}" desta OS? O estoque será estornado.`)) return;
    remover.mutate(
      { id, ordem_id: ordemId },
      {
        onSuccess: () => toast.success("Peça removida — estoque estornado"),
        onError: (e: any) => toast.error(e.message ?? "Erro ao remover peça"),
      },
    );
  };

  const totalCusto = pecas.reduce(
    (sum, p) => sum + Number(p.custo_unitario ?? 0) * Number(p.quantidade ?? 0),
    0,
  );

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Peças utilizadas</h3>
            {pecas.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">{pecas.length}</Badge>
            )}
          </div>
          <Dialog open={modalAberto} onOpenChange={setModalAberto}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8">
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar peça à OS</DialogTitle>
              </DialogHeader>
              <ModalAdicionarPeca
                ordemId={ordemId}
                servicoAtualId={servicoAtualId}
                onSucesso={() => setModalAberto(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : pecas.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            Nenhuma peça usada ainda. Clique em "Adicionar" para registrar.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {pecas.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-md border p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {p.estoque_itens?.nome ?? "Peça"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.quantidade}× ·{" "}
                      {fmtBRL(Number(p.custo_unitario) * Number(p.quantidade))}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleRemover(p.id, p.estoque_itens?.nome ?? "Peça")}
                    disabled={remover.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1 border-t text-xs">
              <span className="text-muted-foreground">Custo total</span>
              <span className="font-semibold">{fmtBRL(totalCusto)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface ModalAdicionarPecaProps {
  ordemId: string;
  servicoAtualId?: string | null;
  onSucesso: () => void;
}

function ModalAdicionarPeca({ ordemId, servicoAtualId, onSucesso }: ModalAdicionarPecaProps) {
  const { data: catalogo = [], isLoading: carregandoCatalogo } = usePecasDisponiveis();
  const adicionar = useAdicionarPecaNaOS();

  const [busca, setBusca] = useState("");
  const [pecaSelecionada, setPecaSelecionada] = useState<PecaDisponivel | null>(null);
  const [quantidade, setQuantidade] = useState(1);

  const pecasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return catalogo.slice(0, 50);
    return catalogo
      .filter((p) => p.nome.toLowerCase().includes(termo) || p.sku?.toLowerCase().includes(termo))
      .slice(0, 50);
  }, [busca, catalogo]);

  const estoqueOk = pecaSelecionada
    ? quantidade > 0 && quantidade <= pecaSelecionada.quantidade
    : false;
  const podeAdicionar = !!pecaSelecionada && estoqueOk && !adicionar.isPending;

  const handleAdicionar = () => {
    if (!pecaSelecionada) return;
    adicionar.mutate(
      {
        ordem_id: ordemId,
        peca_id: pecaSelecionada.id,
        quantidade,
        custo_unitario: Number(pecaSelecionada.custo_medio ?? 0),
        preco_unitario: Number(pecaSelecionada.preco_venda ?? 0),
        origem_servico_id: servicoAtualId ?? null,
      },
      {
        onSuccess: () => {
          toast.success("Peça adicionada · estoque baixado");
          onSucesso();
        },
        onError: (e: any) => toast.error(e.message ?? "Erro ao adicionar peça"),
      },
    );
  };

  if (carregandoCatalogo) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!pecaSelecionada ? (
        <>
          <Input
            placeholder="Buscar peça por nome ou SKU…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoFocus
          />
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {pecasFiltradas.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhuma peça encontrada
              </p>
            ) : (
              pecasFiltradas.map((p) => {
                const semEstoque = p.quantidade <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => !semEstoque && setPecaSelecionada(p)}
                    disabled={semEstoque}
                    className={`w-full text-left text-sm rounded-md border p-2 transition ${
                      semEstoque ? "opacity-50 cursor-not-allowed" : "hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{p.nome}</span>
                      <Badge variant={semEstoque ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                        {p.quantidade} disp.
                      </Badge>
                    </div>
                    {p.sku && <p className="text-[10px] text-muted-foreground mt-0.5">{p.sku}</p>}
                  </button>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          <div className="rounded-md border p-2 bg-accent/30">
            <p className="text-sm font-medium">{pecaSelecionada.nome}</p>
            {pecaSelecionada.sku && (
              <p className="text-[10px] text-muted-foreground">{pecaSelecionada.sku}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {pecaSelecionada.quantidade} disponível ·{" "}
              {fmtBRL(Number(pecaSelecionada.custo_medio ?? 0))} custo médio
            </p>
          </div>

          <div>
            <label className="text-xs font-medium">Quantidade</label>
            <Input
              type="number"
              min={1}
              max={pecaSelecionada.quantidade}
              value={quantidade}
              onChange={(e) =>
                setQuantidade(
                  Math.max(
                    1,
                    Math.min(pecaSelecionada.quantidade, parseInt(e.target.value) || 1),
                  ),
                )
              }
              className="mt-1"
            />
            {!estoqueOk && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3" />
                Quantidade inválida (máx: {pecaSelecionada.quantidade})
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPecaSelecionada(null)}
              disabled={adicionar.isPending}
              className="flex-1"
            >
              Voltar
            </Button>
            <Button onClick={handleAdicionar} disabled={!podeAdicionar} className="flex-1">
              {adicionar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar peça"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
