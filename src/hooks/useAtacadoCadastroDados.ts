import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AtacadoGrade { id: string; nome: string; ordem: number; ativo: boolean }
export interface AtacadoStatus { id: string; nome: string; cor: string; sistema: boolean; ordem: number; ativo?: boolean; categoria?: "em_estoque" | "reservado" | "vendido" | "em_transito" | "outro" }
export interface AtacadoTipoAssistencia { id: string; nome: string; valor_padrao: number; ativo: boolean }
export interface AtacadoMoeda { id: string; codigo: string; simbolo: string | null; nome: string | null; ativo?: boolean }
export interface AtacadoCatalogoModelo {
  id: string;
  marca: string;
  modelo: string;
  capacidades: string[];
  cores: string[];
  ativo: boolean;
}
export interface AtacadoPais { id: string; nome: string; codigo: string | null; ativo: boolean; ordem: number }
export interface AtacadoCapacidade { id: string; nome: string; ativo: boolean; ordem: number }
export interface AtacadoCondicao { id: string; nome: string; ativo: boolean; ordem: number }
export interface AtacadoFornecedor { id: string; nome: string; cnpj_cpf?: string | null; telefone?: string | null; ativo?: boolean }
export interface AtacadoModeloCor { id: string; marca: string | null; modelo: string | null; cor: string; ativo?: boolean }

export function useAtacadoCadastroDados() {
  const [grades, setGrades] = useState<AtacadoGrade[]>([]);
  const [statusList, setStatusList] = useState<AtacadoStatus[]>([]);
  const [tiposAssist, setTiposAssist] = useState<AtacadoTipoAssistencia[]>([]);
  const [moedas, setMoedas] = useState<AtacadoMoeda[]>([]);
  const [catalogo, setCatalogo] = useState<AtacadoCatalogoModelo[]>([]);
  const [paises, setPaises] = useState<AtacadoPais[]>([]);
  const [capacidadesList, setCapacidadesList] = useState<AtacadoCapacidade[]>([]);
  const [condicoes, setCondicoes] = useState<AtacadoCondicao[]>([]);
  const [fornecedores, setFornecedores] = useState<AtacadoFornecedor[]>([]);
  const [coresList, setCoresList] = useState<AtacadoModeloCor[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [g, s, t, m, c, p, cap, cond, forn, cores] = await Promise.all([
      supabase.from("atacado_grades" as any).select("*").order("ordem"),
      supabase.from("atacado_status_aparelho" as any).select("*").order("ordem"),
      supabase.from("atacado_tipos_assistencia" as any).select("*").order("nome"),
      supabase.from("atacado_moedas" as any).select("*").order("codigo"),
      supabase.from("atacado_catalogo_modelos" as any).select("*").eq("ativo", true).order("marca"),
      supabase.from("atacado_paises" as any).select("*").order("ordem"),
      supabase.from("atacado_capacidades" as any).select("*").order("ordem"),
      supabase.from("atacado_condicoes" as any).select("*").order("ordem"),
      supabase.from("fornecedores" as any).select("id,nome,cnpj_cpf,telefone,ativo").order("nome"),
      supabase.from("atacado_modelo_cores" as any).select("*").order("cor"),
    ]);
    setGrades((g.data as any) ?? []);
    setStatusList((s.data as any) ?? []);
    setTiposAssist((t.data as any) ?? []);
    setMoedas((m.data as any) ?? []);
    setCatalogo((c.data as any) ?? []);
    setPaises((p.data as any) ?? []);
    setCapacidadesList((cap.data as any) ?? []);
    setCondicoes((cond.data as any) ?? []);
    setFornecedores((forn.data as any) ?? []);
    setCoresList((cores.data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const marcas = Array.from(new Set(catalogo.map((x) => x.marca))).sort();
  const modelosDe = (marca: string) =>
    catalogo.filter((x) => x.marca === marca).map((x) => x.modelo).filter((m) => m && m !== "—");
  const infoModelo = (marca: string, modelo: string) =>
    catalogo.find((x) => x.marca === marca && x.modelo === modelo) ?? null;

  const coresDe = (marca: string, modelo: string) => {
    const escopo = coresList.filter(
      (c) => (c.ativo ?? true) &&
        (c.marca === null || c.marca?.toLowerCase() === (marca || "").toLowerCase()) &&
        (c.modelo === null || c.modelo?.toLowerCase() === (modelo || "").toLowerCase()),
    );
    return Array.from(new Set(escopo.map((c) => c.cor)));
  };

  // ===== RPCs idempotentes =====
  const rpc = async (fn: string, args: Record<string, any>) => {
    const { data, error } = await supabase.rpc(fn as any, args);
    if (error) throw error;
    await carregar();
    return data;
  };

  const addPais = (nome: string, codigo?: string) =>
    rpc("atacado_add_pais", { p_nome: nome, p_codigo: codigo ?? null });
  const addCapacidade = (nome: string) =>
    rpc("atacado_add_capacidade", { p_nome: nome });
  const addCondicao = (nome: string) =>
    rpc("atacado_add_condicao", { p_nome: nome });
  const addGrade = (nome: string) =>
    rpc("atacado_add_grade", { p_nome: nome });
  const addStatusRpc = (nome: string, cor = "#888", categoria: "em_estoque" | "reservado" | "vendido" | "em_transito" | "em_assistencia" | "outro" = "em_estoque") =>
    rpc("atacado_add_status", { p_nome: nome, p_cor: cor, p_categoria: categoria });
  const addTipoAssist = (nome: string, valor = 0) =>
    rpc("atacado_add_tipo_assistencia", { p_nome: nome, p_valor: valor });
  const addMoedaRpc = (codigo: string, simbolo?: string, nome?: string) =>
    rpc("atacado_add_moeda", { p_codigo: codigo, p_simbolo: simbolo ?? null, p_nome: nome ?? null });
  const addFornecedor = (nome: string, cnpj?: string, telefone?: string) =>
    rpc("atacado_add_fornecedor", { p_nome: nome, p_cnpj: cnpj ?? null, p_telefone: telefone ?? null });
  const addMarcaRpc = (marca: string) =>
    rpc("atacado_add_marca", { p_marca: marca });
  const addModeloRpc = (marca: string, modelo: string) =>
    rpc("atacado_add_modelo", { p_marca: marca, p_modelo: modelo });
  const addCorRpc = (marca: string, modelo: string, cor: string) =>
    rpc("atacado_add_cor", { p_marca: marca, p_modelo: modelo, p_cor: cor });

  const excluirItem = async (lista: string, chave: string) => {
    const { data, error } = await supabase.rpc("atacado_excluir_item" as any, {
      p_lista: lista,
      p_chave: chave,
    });
    if (error) throw error;
    await carregar();
    return data as { success: boolean; error?: string; message?: string };
  };

  // Legacy helpers (mantidos para compat — usam as RPCs por baixo)
  const adicionarModelo = useCallback(
    async (_empresaId: string, marca: string, modelo: string) => {
      await addModeloRpc(marca, modelo);
    },
    [carregar],
  );

  const adicionarCapacidade = useCallback(
    async (_modeloId: string, capacidade: string) => {
      await addCapacidade(capacidade);
    },
    [carregar],
  );

  const adicionarCor = useCallback(
    async (_modeloId: string, cor: string) => {
      // _modeloId é o id do registro em atacado_catalogo_modelos
      const m = catalogo.find((x) => x.id === _modeloId);
      await addCorRpc(m?.marca ?? "", m?.modelo ?? "", cor);
    },
    [catalogo, carregar],
  );

  const adicionarGrade = useCallback(
    async (_empresaId: string, nome: string) => {
      await addGrade(nome);
    },
    [carregar],
  );

  const adicionarStatus = useCallback(
    async (_empresaId: string, nome: string, cor = "#888") => {
      await addStatusRpc(nome, cor);
    },
    [carregar],
  );

  const adicionarMoeda = useCallback(
    async (_empresaId: string, codigo: string, simbolo?: string, nome?: string) => {
      await addMoedaRpc(codigo, simbolo, nome);
    },
    [carregar],
  );

  return {
    grades, statusList, tiposAssist, moedas, catalogo,
    paises, capacidadesList, condicoes, fornecedores, coresList,
    loading,
    marcas, modelosDe, infoModelo, coresDe,
    // legacy
    adicionarModelo, adicionarCapacidade, adicionarCor,
    adicionarGrade, adicionarStatus, adicionarMoeda,
    // novos
    addPais, addCapacidade, addCondicao, addGrade, addStatusRpc,
    addTipoAssist, addMoedaRpc, addFornecedor,
    addMarcaRpc, addModeloRpc, addCorRpc,
    excluirItem,
    recarregar: carregar,
  };
}

export const CURRENCIES_ISO: { codigo: string; simbolo: string; nome: string }[] = [
  { codigo: "BRL", simbolo: "R$", nome: "Real Brasileiro" },
  { codigo: "USD", simbolo: "US$", nome: "Dólar Americano" },
  { codigo: "EUR", simbolo: "€", nome: "Euro" },
  { codigo: "GBP", simbolo: "£", nome: "Libra Esterlina" },
  { codigo: "JPY", simbolo: "¥", nome: "Iene Japonês" },
  { codigo: "CNY", simbolo: "¥", nome: "Yuan Chinês" },
  { codigo: "HKD", simbolo: "HK$", nome: "Dólar de Hong Kong" },
  { codigo: "PYG", simbolo: "₲", nome: "Guarani Paraguaio" },
  { codigo: "ARS", simbolo: "$", nome: "Peso Argentino" },
  { codigo: "CLP", simbolo: "$", nome: "Peso Chileno" },
  { codigo: "UYU", simbolo: "$U", nome: "Peso Uruguaio" },
  { codigo: "MXN", simbolo: "$", nome: "Peso Mexicano" },
  { codigo: "COP", simbolo: "$", nome: "Peso Colombiano" },
  { codigo: "CAD", simbolo: "CA$", nome: "Dólar Canadense" },
  { codigo: "AUD", simbolo: "A$", nome: "Dólar Australiano" },
  { codigo: "CHF", simbolo: "Fr", nome: "Franco Suíço" },
  { codigo: "KRW", simbolo: "₩", nome: "Won Sul-Coreano" },
  { codigo: "INR", simbolo: "₹", nome: "Rupia Indiana" },
  { codigo: "AED", simbolo: "د.إ", nome: "Dirham dos Emirados" },
  { codigo: "TRY", simbolo: "₺", nome: "Lira Turca" },
];
