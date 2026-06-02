import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Copy, ArrowRight, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAtacadoCadastroDados } from "@/hooks/useAtacadoCadastroDados";

interface Vinculo {
  tipo_id: string;
  tipo_nome: string;
  valor: number;
  ativo: boolean;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AssistenciasPorModelo() {
  const { catalogo, tiposAssist, loading: loadingCat } = useAtacadoCadastroDados();
  const [modeloId, setModeloId] = useState<string>("");
  const [lista, setLista] = useState<Vinculo[]>([]);
  const [loading, setLoading] = useState(false);

  // adicionar
  const [novoTipo, setNovoTipo] = useState("");
  const [novoValor, setNovoValor] = useState("");

  // editar inline
  const [editando, setEditando] = useState<string | null>(null);
  const [valorEdit, setValorEdit] = useState("");

  // copiar
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyOrigem, setCopyOrigem] = useState("");

  const modelosOrdenados = useMemo(
    () =>
      [...catalogo].sort((a, b) =>
        `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`),
      ),
    [catalogo],
  );

  const carregar = useCallback(async () => {
    if (!modeloId) {
      setLista([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("atacado_assist_do_modelo" as any, {
      p_modelo_id: modeloId,
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar assistências", { description: error.message });
      return;
    }
    setLista(((data as any) ?? []) as Vinculo[]);
  }, [modeloId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const tiposDisponiveis = useMemo(() => {
    const ids = new Set(lista.map((l) => l.tipo_id));
    return tiposAssist.filter((t) => t.ativo && !ids.has(t.id));
  }, [tiposAssist, lista]);

  const handleAdd = async () => {
    if (!modeloId || !novoTipo) return;
    const valor = parseFloat(novoValor.replace(",", ".")) || 0;
    const { error } = await supabase.rpc("atacado_set_assist_modelo" as any, {
      p_modelo_id: modeloId,
      p_tipo_id: novoTipo,
      p_valor: valor,
    });
    if (error) return toast.error("Erro ao adicionar", { description: error.message });
    toast.success("Assistência vinculada");
    setNovoTipo("");
    setNovoValor("");
    carregar();
  };

  const handleSalvarEdit = async (tipoId: string) => {
    const valor = parseFloat(valorEdit.replace(",", ".")) || 0;
    const { error } = await supabase.rpc("atacado_set_assist_modelo" as any, {
      p_modelo_id: modeloId,
      p_tipo_id: tipoId,
      p_valor: valor,
    });
    if (error) return toast.error("Erro ao salvar", { description: error.message });
    setEditando(null);
    carregar();
  };

  const handleDesativar = async (tipoId: string) => {
    const { error } = await supabase.rpc("atacado_desativar_assist_modelo" as any, {
      p_modelo_id: modeloId,
      p_tipo_id: tipoId,
    });
    if (error) return toast.error("Erro ao desativar", { description: error.message });
    toast.success("Removida deste modelo");
    carregar();
  };

  const handleCopiar = async () => {
    if (!copyOrigem || !modeloId || copyOrigem === modeloId) return;
    const { data, error } = await supabase.rpc("atacado_copiar_assist" as any, {
      p_origem: copyOrigem,
      p_destino: modeloId,
    });
    if (error) return toast.error("Erro ao copiar", { description: error.message });
    toast.success(`${data ?? 0} assistência(s) copiada(s)`);
    setCopyOpen(false);
    setCopyOrigem("");
    carregar();
  };

  // Pré-preenche o valor sugerido ao escolher tipo
  useEffect(() => {
    if (!novoTipo) return;
    const t = tiposAssist.find((x) => x.id === novoTipo);
    if (t && !novoValor) setNovoValor(String(t.valor_padrao ?? 0));
  }, [novoTipo, tiposAssist, novoValor]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Assistências por modelo</h2>
        <p className="text-sm text-muted-foreground">
          Defina quais tipos de assistência se aplicam a cada modelo e o preço específico.
          O preço é carimbado no aparelho ao cadastrar — mudar aqui depois não altera
          aparelhos já cadastrados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
        <div className="space-y-1.5">
          <Label>Modelo</Label>
          <Select value={modeloId} onValueChange={setModeloId} disabled={loadingCat}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um modelo" />
            </SelectTrigger>
            <SelectContent>
              {modelosOrdenados.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.marca} {m.modelo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => setCopyOpen(true)}
          disabled={!modeloId}
        >
          <Copy className="h-4 w-4 mr-2" /> Copiar de outro modelo
        </Button>
      </div>

      {modeloId && (
        <div className="space-y-4">
          {/* Adicionar */}
          <div className="border rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">Adicionar tipo a este modelo</p>
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de assistência</Label>
                <Select value={novoTipo} onValueChange={setNovoTipo}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        tiposDisponiveis.length === 0
                          ? "Todos os tipos já vinculados"
                          : "Escolha um tipo"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposDisponiveis.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                        {t.valor_padrao > 0 && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            sugerido: {brl(Number(t.valor_padrao))}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Preço para este modelo (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <Button onClick={handleAdd} disabled={!novoTipo}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Os tipos (CHOQUE, VIDRO…) são gerenciados na aba "Cadastros".
            </p>
          </div>

          {/* Lista */}
          <div className="border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : lista.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma assistência cadastrada para este modelo.
              </div>
            ) : (
              <div className="divide-y">
                {lista.map((v) => (
                  <div
                    key={v.tipo_id}
                    className="p-3 flex items-center justify-between gap-3"
                  >
                    <div className="font-medium">{v.tipo_nome}</div>
                    <div className="flex items-center gap-2">
                      {editando === v.tipo_id ? (
                        <>
                          <Input
                            value={valorEdit}
                            onChange={(e) => setValorEdit(e.target.value)}
                            className="h-8 w-28"
                            inputMode="decimal"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSalvarEdit(v.tipo_id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditando(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm tabular-nums">{brl(v.valor)}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditando(v.tipo_id);
                              setValorEdit(String(v.valor));
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDesativar(v.tipo_id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copiar assistências de outro modelo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Os vínculos do modelo de origem serão copiados para o modelo selecionado
              (preços inclusos). Tipos já existentes terão seu preço atualizado.
            </p>
            <div className="space-y-1.5">
              <Label>Modelo de origem</Label>
              <Select value={copyOrigem} onValueChange={setCopyOrigem}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o modelo de onde copiar" />
                </SelectTrigger>
                <SelectContent>
                  {modelosOrdenados
                    .filter((m) => m.id !== modeloId)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.marca} {m.modelo}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCopiar} disabled={!copyOrigem}>
              <ArrowRight className="h-4 w-4 mr-2" /> Copiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
