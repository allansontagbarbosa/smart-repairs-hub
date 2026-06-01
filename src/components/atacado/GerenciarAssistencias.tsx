import { useState } from "react";
import { Pencil, Check, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Tipo {
  id: string;
  nome: string;
  valor_padrao: number;
  ativo: boolean;
}

interface Props {
  tipos: Tipo[];
  onChange: () => void;
}

export function GerenciarAssistencias({ tipos, onChange }: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ nome: "", valor: "" });

  async function salvar(id: string | null) {
    if (!draft.nome.trim()) return;
    const { data } = await supabase.rpc("atacado_salvar_tipo_assistencia" as any, {
      p_id: id,
      p_nome: draft.nome.trim(),
      p_valor: parseFloat(draft.valor.replace(",", ".")) || 0,
      p_ativo: true,
    });
    if ((data as any)?.success) {
      setEditId(null);
      setDraft({ nome: "", valor: "" });
      onChange();
    }
  }

  async function toggleAtivo(t: Tipo) {
    await supabase.rpc("atacado_salvar_tipo_assistencia" as any, {
      p_id: t.id,
      p_nome: t.nome,
      p_valor: t.valor_padrao,
      p_ativo: !t.ativo,
    });
    onChange();
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Edite o valor quando o preço mudar. Alterar aqui não muda o custo de aparelhos já
        cadastrados — o valor é carimbado no momento do cadastro.
      </p>
      <div className="space-y-2">
        {tipos.map((t) =>
          editId === t.id ? (
            <div key={t.id} className="flex items-center gap-2">
              <Input
                value={draft.nome}
                onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                className="flex-1"
              />
              <Input
                value={draft.valor}
                onChange={(e) => setDraft({ ...draft, valor: e.target.value })}
                placeholder="0,00"
                className="w-28"
                inputMode="decimal"
              />
              <Button size="icon" variant="ghost" onClick={() => salvar(t.id)}>
                <Check className="h-4 w-4 text-primary" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setEditId(null)}>
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <div
              key={t.id}
              className="flex items-center justify-between p-2 rounded-md border bg-card"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">{t.nome}</span>
                <Badge variant={t.ativo ? "default" : "secondary"} className="text-[10px]">
                  {t.ativo ? "ativo" : "inativo"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm tabular-nums text-foreground">
                  R$ {Number(t.valor_padrao).toFixed(2).replace(".", ",")}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditId(t.id);
                    setDraft({ nome: t.nome, valor: String(t.valor_padrao) });
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <button
                  type="button"
                  onClick={() => toggleAtivo(t)}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {t.ativo ? "inativar" : "ativar"}
                </button>
              </div>
            </div>
          ),
        )}
      </div>

      {editId === "novo" ? (
        <div className="flex items-center gap-2">
          <Input
            value={draft.nome}
            onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
            placeholder="Nome (ex: Troca de tela)"
            className="flex-1"
          />
          <Input
            value={draft.valor}
            onChange={(e) => setDraft({ ...draft, valor: e.target.value })}
            placeholder="0,00"
            className="w-28"
            inputMode="decimal"
          />
          <Button size="icon" variant="ghost" onClick={() => salvar(null)}>
            <Check className="h-4 w-4 text-primary" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setEditId(null)}>
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditId("novo");
            setDraft({ nome: "", valor: "" });
          }}
          className="w-full text-sm border border-dashed rounded-md px-3 py-2 text-muted-foreground hover:bg-muted flex items-center gap-1 justify-center"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar tipo de assistência
        </button>
      )}
    </div>
  );
}
