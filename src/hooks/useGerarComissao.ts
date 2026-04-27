import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type OrdemComissao = {
  id: string;
  funcionario_id: string | null;
  valor: number | string | null;
  custo_pecas: number | string | null;
  empresa_id: string | null;
  status: string | null;
};

const STATUS_CONCLUIDOS = new Set(["pronto", "entregue"]);

export function useGerarComissao() {
  const gerarOuAtualizarComissao = useCallback(async (ordem: OrdemComissao) => {
    if (!ordem.funcionario_id || !STATUS_CONCLUIDOS.has(ordem.status ?? "")) return;

    const valorOS = Number(ordem.valor ?? 0);
    const custoPecas = Number(ordem.custo_pecas ?? 0);
    if (valorOS <= 0) return;

    const { data: funcionario, error: funcionarioError } = await supabase
      .from("funcionarios")
      .select("id, tipo_comissao, valor_comissao, ativo, deleted_at")
      .eq("id", ordem.funcionario_id)
      .maybeSingle();

    if (funcionarioError) throw funcionarioError;
    if (!funcionario?.ativo || funcionario.deleted_at) return;

    const tipo = funcionario.tipo_comissao;
    const valorConfig = Number(funcionario.valor_comissao ?? 0);
    const base = valorOS - custoPecas;
    const valorCalculado = tipo === "fixa"
      ? valorConfig
      : tipo === "percentual"
        ? (valorConfig / 100) * base
        : 0;

    if (base < 0 || valorCalculado <= 0) return;

    const valor = Number(valorCalculado.toFixed(2));
    const valorBase = tipo === "percentual" ? Number(base.toFixed(2)) : null;

    const { data: comissaoExistente, error: comissaoError } = await supabase
      .from("comissoes")
      .select("id, valor, valor_base, tipo")
      .eq("ordem_id", ordem.id)
      .is("estornada_em", null)
      .maybeSingle();

    if (comissaoError) throw comissaoError;

    if (comissaoExistente) {
      const mesmoValor = Number(comissaoExistente.valor ?? 0) === valor;
      const mesmaBase = tipo !== "percentual" || Number(comissaoExistente.valor_base ?? 0) === Number(valorBase ?? 0);
      const mesmoTipo = comissaoExistente.tipo === tipo;
      if (mesmoValor && mesmaBase && mesmoTipo) return;

      const { error } = await supabase
        .from("comissoes")
        .update({ valor, valor_base: valorBase, tipo })
        .eq("id", comissaoExistente.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("comissoes").insert({
      funcionario_id: ordem.funcionario_id,
      ordem_id: ordem.id,
      empresa_id: ordem.empresa_id,
      valor,
      valor_base: valorBase,
      status: "pendente",
      tipo,
      observacoes: "Gerada automaticamente",
    });
    if (error) throw error;
  }, []);

  return { gerarOuAtualizarComissao };
}