import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AtacadoGrade {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}
export interface AtacadoStatus {
  id: string;
  nome: string;
  cor: string;
  sistema: boolean;
  ordem: number;
}
export interface AtacadoTipoAssistencia {
  id: string;
  nome: string;
  valor_padrao: number;
  ativo: boolean;
}
export interface AtacadoMoeda {
  id: string;
  codigo: string;
  simbolo: string | null;
  nome: string | null;
}

export function useAtacadoCadastroDados() {
  const [grades, setGrades] = useState<AtacadoGrade[]>([]);
  const [statusList, setStatusList] = useState<AtacadoStatus[]>([]);
  const [tiposAssist, setTiposAssist] = useState<AtacadoTipoAssistencia[]>([]);
  const [moedas, setMoedas] = useState<AtacadoMoeda[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [g, s, t, m] = await Promise.all([
      supabase.from("atacado_grades" as any).select("*").eq("ativo", true).order("ordem"),
      supabase.from("atacado_status_aparelho" as any).select("*").order("ordem"),
      supabase.from("atacado_tipos_assistencia" as any).select("*").eq("ativo", true),
      supabase.from("atacado_moedas" as any).select("*").order("codigo"),
    ]);
    setGrades((g.data as any) ?? []);
    setStatusList((s.data as any) ?? []);
    setTiposAssist((t.data as any) ?? []);
    setMoedas((m.data as any) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const coresDoModelo = useCallback(async (marca: string, modelo: string) => {
    if (!marca || !modelo) return [];
    const { data } = await supabase
      .from("atacado_modelo_cores" as any)
      .select("cor")
      .eq("marca", marca)
      .eq("modelo", modelo);
    return ((data as any[]) ?? []).map((r) => r.cor as string);
  }, []);

  const adicionarCor = useCallback(
    async (empresaId: string, marca: string, modelo: string, cor: string) => {
      await supabase
        .from("atacado_modelo_cores" as any)
        .insert({ empresa_id: empresaId, marca, modelo, cor });
    },
    [],
  );

  const adicionarGrade = useCallback(
    async (empresaId: string, nome: string) => {
      await supabase
        .from("atacado_grades" as any)
        .insert({ empresa_id: empresaId, nome, ordem: grades.length });
      await carregar();
    },
    [grades.length, carregar],
  );

  const adicionarStatus = useCallback(
    async (empresaId: string, nome: string) => {
      await supabase
        .from("atacado_status_aparelho" as any)
        .insert({ empresa_id: empresaId, nome, ordem: statusList.length });
      await carregar();
    },
    [statusList.length, carregar],
  );

  const adicionarMoeda = useCallback(
    async (empresaId: string, codigo: string, simbolo?: string, nome?: string) => {
      await supabase
        .from("atacado_moedas" as any)
        .insert({ empresa_id: empresaId, codigo, simbolo, nome });
      await carregar();
    },
    [carregar],
  );

  const adicionarTipoAssistencia = useCallback(
    async (empresaId: string, nome: string, valor: number) => {
      await supabase
        .from("atacado_tipos_assistencia" as any)
        .insert({ empresa_id: empresaId, nome, valor_padrao: valor });
      await carregar();
    },
    [carregar],
  );

  return {
    grades,
    statusList,
    tiposAssist,
    moedas,
    loading,
    coresDoModelo,
    adicionarCor,
    adicionarGrade,
    adicionarStatus,
    adicionarMoeda,
    adicionarTipoAssistencia,
    recarregar: carregar,
  };
}

// Moedas ISO 4217 mais comuns (lista resumida; usuário pode digitar outras)
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
