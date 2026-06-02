import { useState } from "react";
import { Loader2, Plus, Power, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useAtacadoCadastroDados,
  CURRENCIES_ISO,
} from "@/hooks/useAtacadoCadastroDados";

type Lista = {
  key: string;
  label: string;
  tabela: string;
  // items: array of { id, nome, ativo? }
  itens: Array<{ id: string; nome: string; ativo?: boolean; extra?: string }>;
  add: (nome: string) => Promise<any>;
};

export function ListasManager() {
  const dados = useAtacadoCadastroDados();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});

  if (dados.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const listas: Lista[] = [
    {
      key: "moedas",
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
      key: "fornecedores",
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
      key: "paises",
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
      key: "marcas",
      label: "Marcas",
      tabela: "atacado_catalogo_modelos",
      itens: dados.marcas.map((m) => ({ id: m, nome: m, ativo: true })),
      add: async (nome) => {
        await dados.addMarcaRpc(nome);
      },
    },
    {
      key: "capacidades",
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
      key: "cores",
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
      key: "grades",
      label: "Grades",
      tabela: "atacado_grades",
      itens: dados.grades.map((g) => ({ id: g.id, nome: g.nome, ativo: g.ativo })),
      add: async (nome) => {
        await dados.addGrade(nome);
      },
    },
    {
      key: "condicoes",
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
      key: "tipos_assist",
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

  const handleAdd = async (lista: Lista) => {
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

  const toggleAtivo = async (lista: Lista, id: string, novoAtivo: boolean) => {
    setSavingKey(`${lista.key}-${id}`);
    try {
      const { error } = await supabase
        .from(lista.tabela as any)
        .update({ ativo: novoAtivo })
        .eq("id", id);
      if (error) throw error;
      await dados.recarregar();
      toast.success(novoAtivo ? "Reativado" : "Desativado");
    } catch (e: any) {
      toast.error("Não foi possível alterar", {
        description:
          e.message?.includes("ativo")
            ? "Esta lista não suporta desativação ainda."
            : e.message,
      });
    } finally {
      setSavingKey(null);
    }
  };

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
              {lista.itens.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
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
                      <p className="text-[11px] text-muted-foreground truncate">
                        {it.extra}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAtivo(lista, it.id, !(it.ativo ?? true))}
                    disabled={savingKey === `${lista.key}-${it.id}`}
                    title={it.ativo === false ? "Reativar" : "Desativar"}
                  >
                    <Power
                      className={`h-3.5 w-3.5 ${
                        it.ativo === false ? "text-muted-foreground" : "text-emerald-500"
                      }`}
                    />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Dica: itens já usados em aparelhos/invoices não devem ser apagados — use o
        botão de desativar (some dos selects de cadastro novo, mas o histórico
        continua íntegro).
      </p>
    </div>
  );
}
