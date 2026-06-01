import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Calibracao {
  offset_x_mm: number;
  offset_y_mm: number;
  margem_mm: number;
  alinhamento: string;
  largura_mm: number;
  altura_mm: number;
}

export const CALIBRACAO_PADRAO: Calibracao = {
  offset_x_mm: 0,
  offset_y_mm: 0,
  margem_mm: 2,
  alinhamento: "mc",
  largura_mm: 54,
  altura_mm: 25,
};

export function useEtiquetaCalibracao() {
  const [cal, setCal] = useState<Calibracao>(CALIBRACAO_PADRAO);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("etiqueta_calibracao" as any)
      .select("*")
      .maybeSingle();
    if (data) {
      const d = data as any;
      setCal({
        offset_x_mm: Number(d.offset_x_mm) || 0,
        offset_y_mm: Number(d.offset_y_mm) || 0,
        margem_mm: Number(d.margem_mm) || 2,
        alinhamento: d.alinhamento || "mc",
        largura_mm: Number(d.largura_mm) || 54,
        altura_mm: Number(d.altura_mm) || 25,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const salvar = async (c: Calibracao) => {
    const { data, error } = await supabase.rpc("salvar_calibracao_etiqueta" as any, {
      p_offset_x: c.offset_x_mm,
      p_offset_y: c.offset_y_mm,
      p_margem: c.margem_mm,
      p_alinhamento: c.alinhamento,
      p_largura: c.largura_mm,
      p_altura: c.altura_mm,
    });
    if (error) return false;
    const ok = (data as any)?.success;
    if (ok) setCal(c);
    return !!ok;
  };

  return { cal, loading, salvar, recarregar: carregar, PADRAO: CALIBRACAO_PADRAO };
}

/** Carrega a calibração uma única vez de forma direta (para uso em funções de impressão). */
export async function buscarCalibracaoAtual(): Promise<Calibracao> {
  try {
    const { data } = await supabase
      .from("etiqueta_calibracao" as any)
      .select("*")
      .maybeSingle();
    if (!data) return CALIBRACAO_PADRAO;
    const d = data as any;
    return {
      offset_x_mm: Number(d.offset_x_mm) || 0,
      offset_y_mm: Number(d.offset_y_mm) || 0,
      margem_mm: Number(d.margem_mm) || 2,
      alinhamento: d.alinhamento || "mc",
      largura_mm: Number(d.largura_mm) || 54,
      altura_mm: Number(d.altura_mm) || 25,
    };
  } catch {
    return CALIBRACAO_PADRAO;
  }
}

export function alinhamentoToFlex(a: string) {
  const v = a[0];
  const h = a[1];
  return {
    justifyContent: v === "t" ? "flex-start" : v === "b" ? "flex-end" : "center",
    alignItems: h === "l" ? "flex-start" : h === "r" ? "flex-end" : "center",
    textAlign: (h === "l" ? "left" : h === "r" ? "right" : "center") as "left" | "right" | "center",
  };
}
