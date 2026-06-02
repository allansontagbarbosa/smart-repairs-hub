import { useMemo, useState } from "react";
import { Loader2, Plus, Power, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useAtacadoCadastroDados,
  CURRENCIES_ISO,
} from "@/hooks/useAtacadoCadastroDados";

type Item = { id: string; nome: string; ativo?: boolean; extra?: string };
type Lista = {
  key: string;          // chave da lista (usada no RPC excluir)
  label: string;
  tabela: string;       // tabela para toggle ativo
  idIsText?: boolean;   // marca usa o próprio nome como id
  itens: Item[];
  add: (nome: string) => Promise<any>;
};

export function ListasManager() {
  const dados = useAtacadoCadastroDados();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [marcaSelecionada, setMarcaSelecionada] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState<{
    lista: string;
    chave: string;
    nome: string;
    label: string;
  } | null>(null);

  // Marcas reais = distinct(marca) do catálogo
  const marcasReais = useMemo(() => dados.marcas, [dados.marcas]);

  // Auto-seleciona primeira marca quando carregar
  if (!marcaSelecionada && marcasReais.length > 0) {
    setMarcaSelecionada(marcasReais[0]);
  }

  if (dados.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ===== Lista "Modelos" (especial — depende da marca selecionada) =====
  const modelosDaMarca = marcaSelecionada
    ? dados.catalogo
        .filter(
          (c) =>
            c.marca === marcaSelecionada &&
            c.modelo &&
            c.modelo !== "—" &&
            c.modelo !== "-",
        )
        .map((c) => ({ id: c.id, nome: c.modelo, ativo: c.ativo }))
    : [];

  const listas: Lista[] = [
    {
      key: "moeda",
      label: "Moedas",
      tabela: "atacado_moedas",
      itens: dados.moedas.map((m) => ({
        id: m.id,
        nome: m.codigo,
        ativo: (m as any).ativo ?? true,
        extra: m.simbolo || m.nome || "",
      })),
      add: async (codigo) => {
        const iso = CURRENCIES_ISO.find((c) => c.codigo === codigo.toUpperCase());
        await dados.addMoedaRpc(codigo, iso?.simbolo, iso?.nome);
      },
    },
    {
      key: "fornecedor",
      label: "Fornecedores",
      tabela: "fornecedores",
      itens: dados.fornecedores.map((f) => ({
        id: f.id,
        nome: f.nome,
        ativo: f.ativo ?? true,
        extra: f.cnpj_cpf || "",
      })),
      add: async (nome) => {
        await dados.addFornecedor(nome);
      },
    },
    {
      key: "pais",
      label: "Países",
      tabela: "atacado_paises",
      itens: dados.paises.map((p) => ({
        id: p.id,
        nome: p.nome,
        ativo: p.ativo,
        extra: p.codigo || "",
      })),
      add: async (nome) => {
        await dados.addPais(nome);
      },
    },
    {
      key: "marca",
      label: "Marcas",
      tabela: "atacado_catalogo_modelos",
      idIsText: true,
      itens: marcasReais.map((m) => ({ id: m, nome: m, ativo: true })),
      add: async (nome) => {
        await dados.addMarcaRpc(nome);
      },
    },
    {
      key: "capacidade",
      label: "Capacidades",
      tabela: "atacado_capacidades",
      itens: dados.capacidadesList.map((c) => ({
        id: c.id,
        nome: c.nome,
        ativo: c.ativo,
      })),
      add: async (nome) => {
        await dados.addCapacidade(nome);
      },
    },
    {
      key: "cor",
      label: "Cores",
      tabela: "atacado_modelo_cores",
      itens: dados.coresList.map((c) => ({
        id: c.id,
        nome: c.cor,
        ativo: c.ativo ?? true,
        extra: c.marca && c.modelo ? `${c.marca} ${c.modelo}` : "",
      })),
      add: async (nome) => {
        await dados.addCorRpc("", "", nome);
      },
    },
    {
      key: "grade",
      label: "Grades",
      tabela: "atacado_grades",
      itens: dados.grades.map((g) => ({ id: g.id, nome: g.nome, ativo: g.ativo })),
      add: async (nome) => {
        await dados.addGrade(nome);
      },
    },
    {
      key: "condicao",
      label: "Condições",
      tabela: "atacado_condicoes",
      itens: dados.condicoes.map((c) => ({ id: c.id, nome: c.nome, ativo: c.ativo })),
      add: async (nome) => {
        await dados.addCondicao(nome);
      },
    },
    {
      key: "status",
      label: "Status de aparelho",
      tabela: "atacado_status_aparelho",
      itens: dados.statusList.map((s) => ({
        id: s.id,
        nome: s.nome,
        ativo: s.ativo ?? true,
        extra: s.cor,
      })),
      add: async (nome) => {
        await dados.addStatusRpc(nome);
      },
    },
    {
      key: "tipo_assist",
      label: "Tipos de assistência",
      tabela: "atacado_tipos_assistencia",
      itens: dados.tiposAssist.map((t) => ({
        id: t.id,
        nome: t.nome,
        ativo: t.ativo,
        extra: t.valor_padrao
          ? Number(t.valor_padrao).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })
          : "",
      })),
      add: async (nome) => {
        await dados.addTipoAssist(nome);
      },
    },
  ];

  const handleAdd = async (lista: { key: string; label: string; add: (n: string) => Promise<any> }) => {
    const nome = (inputs[lista.key] || "").trim();
    if (!nome) return;
    setSavingKey(lista.key);
    try {
      await lista.add(nome);
      setInputs((s) => ({ ...s, [lista.key]: "" }));
      toast.success(`${lista.label}: "${nome}" adicionado`);
    } catch (e: any) {
      toast.error("Erro ao adicionar", { description: e.message });
    } finally {
      setSavingKey(null);
    }
  };

  const handleAddModelo = async () => {
    const nome = (inputs["modelo"] || "").trim();
    if (!nome || !marcaSelecionada) return;
    setSavingKey("modelo");
    try {
      await dados.addModeloRpc(marcaSelecionada, nome);
      setInputs((s) => ({ ...s, modelo: "" }));
      toast.success(`Modelo "${nome}" adicionado a ${marcaSelecionada}`);
    } catch (e: any) {
      toast.error("Erro ao adicionar", { description: e.message });
    } finally {
      setSavingKey(null);
    }
  };

  const toggleAtivo = async (lista: Lista, item: Item) => {
    if (lista.idIsText) {
      toast.info("Marcas não têm desativação direta — exclua se não estiver em uso.");
      return;
    }
    const novoAtivo = !(item.ativo ?? true);
    setSavingKey(`${lista.key}-${item.id}`);
    try {
      const { error } = await supabase
        .from(lista.tabela as any)
        .update({ ativo: novoAtivo })
        .eq("id", item.id);
      if (error) throw error;
      await dados.recarregar();
      toast.success(novoAtivo ? "Reativado" : "Desativado");
    } catch (e: any) {
      toast.error("Não foi possível alterar", { description: e.message });
    } finally {
      setSavingKey(null);
    }
  };

  const handleExcluir = async () => {
    if (!confirmDelete) return;
    setSavingKey(`del-${confirmDelete.chave}`);
    try {
      const res = await dados.excluirItem(confirmDelete.lista, confirmDelete.chave);
      if (!res?.success) {
        if (res?.error === "em_uso") {
          toast.error("Em uso — não pode ser excluído", {
            description: res.message || "Desative em vez de excluir.",
          });
        } else {
          toast.error("Não foi possível excluir", { description: res?.error || "" });
        }
      } else {
        toast.success(`"${confirmDelete.nome}" excluído`);
      }
    } catch (e: any) {
      toast.error("Erro ao excluir", { description: e.message });
    } finally {
      setSavingKey(null);
      setConfirmDelete(null);
    }
  };

  const renderItem = (lista: Lista, it: Item) => (
    <div key={it.id} className="flex items-center justify-between gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm truncate ${
            it.ativo === false
              ? "text-muted-foreground line-through"
              : "text-foreground"
          }`}
        >
          {it.nome}
        </p>
        {it.extra && (
          <p className="text-[11px] text-muted-foreground truncate">{it.extra}</p>
        )}
      </div>
      {!lista.idIsText && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toggleAtivo(lista, it)}
          disabled={savingKey === `${lista.key}-${it.id}`}
          title={it.ativo === false ? "Reativar" : "Desativar"}
        >
          <Power
            className={`h-3.5 w-3.5 ${
              it.ativo === false ? "text-muted-foreground" : "text-emerald-500"
            }`}
          />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          setConfirmDelete({
            lista: lista.key,
            chave: it.id,
            nome: it.nome,
            label: lista.label,
          })
        }
        disabled={savingKey === `del-${it.id}`}
        title="Excluir (só se nunca foi usado)"
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Listas e cadastros</h2>
          <p className="text-sm text-muted-foreground">
            Fonte única dos campos do Atacado. Adicionar aqui reflete em todos os
            formulários da empresa.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => dados.recarregar()}>
          <RefreshCw className="h-3 w-3" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Seção especial: Modelos (vinculados à marca) */}
        <Card className="p-4 space-y-3 md:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">Modelos</h3>
              <span className="text-xs text-muted-foreground">
                — vinculados a uma marca
              </span>
            </div>
            <Badge variant="outline" className="text-xs">
              {modelosDaMarca.length}{" "}
              {modelosDaMarca.length === 1 ? "modelo" : "modelos"}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground">Marca:</span>
            <Select value={marcaSelecionada} onValueChange={setMarcaSelecionada}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder="Selecione a marca" />
              </SelectTrigger>
              <SelectContent>
                {marcasReais.length === 0 && (
                  <SelectItem value="__none__" disabled>
                    Nenhuma marca cadastrada
                  </SelectItem>
                )}
                {marcasReais.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2 flex-1 min-w-[200px]">
              <Input
                value={inputs["modelo"] || ""}
                onChange={(e) =>
                  setInputs((s) => ({ ...s, modelo: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddModelo();
                  }
                }}
                placeholder={
                  marcaSelecionada
                    ? `Novo modelo de ${marcaSelecionada}…`
                    : "Selecione uma marca primeiro"
                }
                disabled={!marcaSelecionada}
                className="h-9"
              />
              <Button
                size="sm"
                onClick={handleAddModelo}
                disabled={
                  savingKey === "modelo" ||
                  !marcaSelecionada ||
                  !(inputs["modelo"] || "").trim()
                }
              >
                {savingKey === "modelo" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
            {!marcaSelecionada && (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                Selecione uma marca acima para ver/adicionar modelos.
              </p>
            )}
            {marcaSelecionada && modelosDaMarca.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                Nenhum modelo cadastrado para {marcaSelecionada}.
              </p>
            )}
            {modelosDaMarca.map((it) =>
              renderItem(
                {
                  key: "modelo",
                  label: "Modelos",
                  tabela: "atacado_catalogo_modelos",
                  itens: [],
                  add: async () => {},
                },
                it,
              ),
            )}
          </div>
        </Card>

        {/* Demais listas */}
        {listas.map((lista) => (
          <Card key={lista.key} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{lista.label}</h3>
              <Badge variant="outline" className="text-xs">
                {lista.itens.length} {lista.itens.length === 1 ? "item" : "itens"}
              </Badge>
            </div>

            <div className="flex gap-2">
              <Input
                value={inputs[lista.key] || ""}
                onChange={(e) =>
                  setInputs((s) => ({ ...s, [lista.key]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd(lista);
                  }
                }}
                placeholder={`Adicionar ${lista.label.toLowerCase()}…`}
                className="h-9"
              />
              <Button
                size="sm"
                onClick={() => handleAdd(lista)}
                disabled={
                  savingKey === lista.key || !(inputs[lista.key] || "").trim()
                }
              >
                {savingKey === lista.key ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
              </Button>
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
              {lista.itens.length === 0 && (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                  Nenhum item ainda
                </p>
              )}
              {lista.itens.map((it) => renderItem(lista, it))}
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Dica: itens já usados em aparelhos/invoices não podem ser excluídos — use o
        botão de desativar (some dos selects de cadastro novo, mas o histórico
        continua íntegro).
      </p>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {confirmDelete?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Se o item já tiver sido usado em
              algum aparelho ou invoice, a exclusão será recusada — nesse caso,
              desative em vez de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
