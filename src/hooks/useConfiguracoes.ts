import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresa } from "@/contexts/EmpresaContext";

export function useConfiguracoes() {
  const qc = useQueryClient();
  const { empresaId, empresa: empresaContext } = useEmpresa();

  const { data: empresa, isLoading: loadingEmpresa } = useQuery({
    queryKey: ["empresa_config", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa_config")
        .select("*")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: fornecedores = [], isLoading: loadingFornecedores } = useQuery({
    queryKey: ["fornecedores", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("fornecedores").select("*").eq("empresa_id", empresaId!).order("nome");
      return data || [];
    },
  });

  const { data: produtosBase = [], isLoading: loadingProdutos } = useQuery({
    queryKey: ["produtos_base", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("estoque_itens")
        .select("*, marcas(nome), modelos(nome), estoque_categorias(nome)")
        .eq("empresa_id", empresaId!)
        .eq("tipo_item", "peca")
        .is("deleted_at", null)
        .order("nome_personalizado");
      return data || [];
    },
  });

  const { data: tiposServico = [], isLoading: loadingServicos } = useQuery({
    queryKey: ["tipos_servico", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("tipos_servico").select("*").eq("empresa_id", empresaId!).order("nome");
      return data || [];
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["funcionarios", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("funcionarios").select("*").eq("empresa_id", empresaId!).is("deleted_at", null).order("nome");
      return data || [];
    },
  });

  // perfis_acesso: tabela GLOBAL — não filtrar por empresa_id.
  const { data: perfisAcesso = [] } = useQuery({
    queryKey: ["perfis_acesso"],
    queryFn: async () => {
      const { data } = await supabase.from("perfis_acesso").select("*").order("nome_perfil");
      return data || [];
    },
  });

  const {
    data: userProfiles = [],
    isLoading: userProfilesLoading,
    error: userProfilesError,
    refetch: refetchUserProfiles,
  } = useQuery({
    queryKey: ["user_profiles", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select(`
          id,
          user_id,
          nome_exibicao,
          ativo,
          perfil_id,
          funcionario_id,
          empresa_id,
          created_at,
          perfis_acesso ( nome_perfil, permissoes ),
          funcionarios ( nome, email )
        `)
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("[useConfiguracoes] erro ao listar user_profiles:", error);
        throw error;
      }
      // Filtra ativo=true OU null em JS (contorna conflitos com RLS no or=)
      return (data || []).filter((u: any) => u.ativo === true || u.ativo === null);
    },
  });

  const { data: categoriasFinanceiras = [] } = useQuery({
    queryKey: ["categorias_financeiras", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("categorias_financeiras").select("*").eq("empresa_id", empresaId!).order("nome");
      return data || [];
    },
  });

  const { data: centrosCusto = [] } = useQuery({
    queryKey: ["centros_custo", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("centros_custo").select("*").eq("empresa_id", empresaId!).order("nome");
      return data || [];
    },
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ["formas_pagamento", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("formas_pagamento").select("*").eq("empresa_id", empresaId!).order("nome");
      return data || [];
    },
  });

  const { data: estoqueCategorias = [] } = useQuery({
    queryKey: ["estoque_categorias", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("estoque_categorias").select("*").eq("empresa_id", empresaId!).order("nome");
      return data || [];
    },
  });

  // marcas/modelos/cores/capacidades: tabelas de catálogo compartilhadas — não filtrar por empresa.
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
      const { data } = await supabase.from("modelos").select("*, marcas(nome)");
      const { sortByNomeNatural } = await import("@/lib/naturalSort");
      return sortByNomeNatural(data || []);
    },
  });

  const { data: cores = [] } = useQuery({
    queryKey: ["cores"],
    queryFn: async () => {
      const { data } = await supabase.from("cores").select("*");
      const { sortByNomeNatural } = await import("@/lib/naturalSort");
      return sortByNomeNatural(data || []);
    },
  });

  const { data: capacidades = [] } = useQuery({
    queryKey: ["capacidades"],
    queryFn: async () => {
      const { data } = await supabase.from("capacidades").select("*");
      const { sortCapacidades } = await import("@/lib/naturalSort");
      return sortCapacidades(data || []);
    },
  });

  // status_ordem_servico: pulo (não tem coluna empresa_id confirmada — manter como estava)
  const { data: statusOrdem = [] } = useQuery({
    queryKey: ["status_ordem_servico"],
    queryFn: async () => {
      const { data } = await supabase.from("status_ordem_servico").select("*").order("ordem_exibicao");
      return data || [];
    },
  });

  const { data: templatesMensagem = [] } = useQuery({
    queryKey: ["templates_mensagem", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("templates_mensagem").select("*").eq("empresa_id", empresaId!).order("evento");
      return data || [];
    },
  });

  const { data: modelosDocumento = [] } = useQuery({
    queryKey: ["modelos_documento", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("modelos_documento").select("*").eq("empresa_id", empresaId!).order("tipo");
      return data || [];
    },
  });

  const { data: listasPreco = [] } = useQuery({
    queryKey: ["listas_preco", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("listas_preco").select("*, clientes(nome)").eq("empresa_id", empresaId!).order("nome");
      return data || [];
    },
  });

  // Generic save helper
  const saveEmpresa = useMutation({
    mutationFn: async (values: any) => {
      if (!empresaId) {
        throw new Error("Empresa não identificada");
      }

      const payload = {
        ...values,
        empresa_id: empresaId,
      };

      const { data: existingConfig, error: lookupError } = await supabase
        .from("empresa_config")
        .select("id")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (existingConfig?.id) {
        const { error } = await supabase
          .from("empresa_config")
          .update(payload)
          .eq("id", existingConfig.id);

        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("empresa_config").insert({
        nome: values.nome ?? empresaContext?.nome ?? "",
        ...payload,
      });

      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["empresa_config", empresaId] }); toast.success("Configurações salvas"); },
    onError: (error: Error) => toast.error(error.message || "Erro ao salvar"),
  });

  const isLoading = loadingEmpresa || loadingFornecedores || loadingProdutos || loadingServicos;

  return {
    empresa, fornecedores, produtosBase, tiposServico, funcionarios,
    perfisAcesso, userProfiles, categoriasFinanceiras, centrosCusto,
    formasPagamento, estoqueCategorias, marcas, modelos, cores, capacidades,
    statusOrdem, templatesMensagem, modelosDocumento, listasPreco,
    saveEmpresa, isLoading,
    userProfilesLoading, userProfilesError, refetchUserProfiles,
  };
}
