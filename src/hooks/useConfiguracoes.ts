import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useConfiguracoes() {
  const qc = useQueryClient();

  const { data: empresa, isLoading: loadingEmpresa } = useQuery({
    queryKey: ["empresa_config"],
    queryFn: async () => {
      const { data } = await supabase.from("empresa_config").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const { data: fornecedores = [], isLoading: loadingFornecedores } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data } = await supabase.from("fornecedores").select("*").order("nome");
      return data || [];
    },
  });

  const { data: produtosBase = [], isLoading: loadingProdutos } = useQuery({
    queryKey: ["produtos_base"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos_base").select("*, marcas(nome), modelos(nome), estoque_categorias(nome)").order("nome");
      return data || [];
    },
  });

  const { data: tiposServico = [], isLoading: loadingServicos } = useQuery({
    queryKey: ["tipos_servico"],
    queryFn: async () => {
      const { data } = await supabase.from("tipos_servico").select("*").order("nome");
      return data || [];
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["funcionarios"],
    queryFn: async () => {
      const { data } = await supabase.from("funcionarios").select("*").is("deleted_at", null).order("nome");
      return data || [];
    },
  });

  const { data: perfisAcesso = [] } = useQuery({
    queryKey: ["perfis_acesso"],
    queryFn: async () => {
      const { data } = await supabase.from("perfis_acesso").select("*").order("nome_perfil");
      return data || [];
    },
  });

  const { data: userProfiles = [] } = useQuery({
    queryKey: ["user_profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("*, perfis_acesso(nome_perfil), funcionarios(nome)");
      return data || [];
    },
  });

  const { data: categoriasFinanceiras = [] } = useQuery({
    queryKey: ["categorias_financeiras"],
    queryFn: async () => {
      const { data } = await supabase.from("categorias_financeiras").select("*").order("nome");
      return data || [];
    },
  });

  const { data: centrosCusto = [] } = useQuery({
    queryKey: ["centros_custo"],
    queryFn: async () => {
      const { data } = await supabase.from("centros_custo").select("*").order("nome");
      return data || [];
    },
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ["formas_pagamento"],
    queryFn: async () => {
      const { data } = await supabase.from("formas_pagamento").select("*").order("nome");
      return data || [];
    },
  });

  const { data: estoqueCategorias = [] } = useQuery({
    queryKey: ["estoque_categorias"],
    queryFn: async () => {
      const { data } = await supabase.from("estoque_categorias").select("*").order("nome");
      return data || [];
    },
  });

  const { data: marcas = [] } = useQuery({
    queryKey: ["marcas"],
    queryFn: async () => {
      const { data } = await supabase.from("marcas").select("*").order("nome");
      return data || [];
    },
  });

  const { data: modelos = [] } = useQuery({
    queryKey: ["modelos"],
    queryFn: async () => {
      const { data } = await supabase.from("modelos").select("*, marcas(nome)").order("nome");
      return data || [];
    },
  });

  const { data: statusOrdem = [] } = useQuery({
    queryKey: ["status_ordem_servico"],
    queryFn: async () => {
      const { data } = await supabase.from("status_ordem_servico").select("*").order("ordem_exibicao");
      return data || [];
    },
  });

  const { data: templatesMensagem = [] } = useQuery({
    queryKey: ["templates_mensagem"],
    queryFn: async () => {
      const { data } = await supabase.from("templates_mensagem").select("*").order("evento");
      return data || [];
    },
  });

  const { data: modelosDocumento = [] } = useQuery({
    queryKey: ["modelos_documento"],
    queryFn: async () => {
      const { data } = await supabase.from("modelos_documento").select("*").order("tipo");
      return data || [];
    },
  });

  const { data: listasPreco = [] } = useQuery({
    queryKey: ["listas_preco"],
    queryFn: async () => {
      const { data } = await supabase.from("listas_preco").select("*, clientes(nome)").order("nome");
      return data || [];
    },
  });

  // Generic save helper
  const saveEmpresa = useMutation({
    mutationFn: async (values: any) => {
      if (!empresa?.id) return;
      const { error } = await supabase.from("empresa_config").update(values).eq("id", empresa.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["empresa_config"] }); toast.success("Configurações salvas"); },
    onError: () => toast.error("Erro ao salvar"),
  });

  const isLoading = loadingEmpresa || loadingFornecedores || loadingProdutos || loadingServicos;

  return {
    empresa, fornecedores, produtosBase, tiposServico, funcionarios,
    perfisAcesso, userProfiles, categoriasFinanceiras, centrosCusto,
    formasPagamento, estoqueCategorias, marcas, modelos, statusOrdem,
    templatesMensagem, modelosDocumento, listasPreco,
    saveEmpresa, isLoading,
  };
}
