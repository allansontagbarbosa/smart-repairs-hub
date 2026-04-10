import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export type EstoqueItem = {
  id: string;
  tipo_item: string;
  categoria_id: string | null;
  marca_id: string | null;
  modelo_id: string | null;
  nome_personalizado: string | null;
  cor: string | null;
  capacidade: string | null;
  imei_serial: string | null;
  sku: string | null;
  quantidade: number;
  quantidade_minima: number;
  custo_unitario: number | null;
  preco_venda: number | null;
  local_estoque: string | null;
  fornecedor: string | null;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  estoque_categorias?: { nome: string } | null;
  marcas?: { nome: string } | null;
  modelos?: { nome: string } | null;
};

async function fetchEstoqueItens() {
  const { data, error } = await supabase
    .from("estoque_itens")
    .select("*, estoque_categorias:categoria_id ( nome ), marcas:marca_id ( nome ), modelos:modelo_id ( nome )")
    .is("deleted_at", null)
    .in("tipo_item", ["peca", "acessorio"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EstoqueItem[];
}

async function fetchCategorias() {
  const { data, error } = await supabase.from("estoque_categorias").select("*").eq("ativo", true).order("nome");
  if (error) throw error;
  return data ?? [];
}

async function fetchMarcas() {
  const { data, error } = await supabase.from("marcas").select("*").eq("ativo", true).order("nome");
  if (error) throw error;
  return data ?? [];
}

async function fetchModelos() {
  const { data, error } = await supabase.from("modelos").select("*, marcas ( nome )").eq("ativo", true).order("nome");
  if (error) throw error;
  return data ?? [];
}

async function fetchConferencias() {
  const { data, error } = await supabase
    .from("conferencias_estoque")
    .select("*, conferencia_itens ( * )")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export function useEstoque() {
  const itens = useQuery({ queryKey: ["estoque_itens"], queryFn: fetchEstoqueItens });
  const categorias = useQuery({ queryKey: ["estoque_categorias"], queryFn: fetchCategorias });
  const marcas = useQuery({ queryKey: ["marcas"], queryFn: fetchMarcas });
  const modelos = useQuery({ queryKey: ["modelos"], queryFn: fetchModelos });
  const conferencias = useQuery({ queryKey: ["conferencias"], queryFn: fetchConferencias });

  const isLoading = itens.isLoading;

  const kpis = useMemo(() => {
    const all = itens.data ?? [];
    const total = all.length;
    const pecas = all.filter(i => i.tipo_item === "peca").length;
    const acessorios = all.filter(i => i.tipo_item === "acessorio").length;
    const estoqueBaixo = all.filter(i => i.quantidade_minima > 0 && i.quantidade <= i.quantidade_minima).length;
    const valorTotal = all.reduce((s, i) => s + (Number(i.custo_unitario ?? 0) * i.quantidade), 0);
    return { total, pecas, acessorios, estoqueBaixo, valorTotal };
  }, [itens.data]);

  return {
    itens: itens.data ?? [],
    categorias: categorias.data ?? [],
    marcas: marcas.data ?? [],
    modelos: modelos.data ?? [],
    conferencias: conferencias.data ?? [],
    isLoading,
    kpis,
    refetch: itens.refetch,
    refetchAll: () => {
      itens.refetch();
      categorias.refetch();
      marcas.refetch();
      modelos.refetch();
    },
  };
}
