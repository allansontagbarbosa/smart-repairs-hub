import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface DREMensal {
  competencia: string;
  receitaBruta: number;
  impostos: number;
  receitaLiquida: number;
  custoPecas: number;
  comissoes: number;
  prejuizosOperacionais: number;
  lucroBruto: number;
  gastosFixos: number;
  outrosGastos: number;
  ebitda: number;
  margemLiquida: number;
  qtdOSs: number;
  ticketMedio: number;
}

export function useDREProfissional(competencia: string) {
  const anterior = useMemo(() => {
    const [y, m] = competencia.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [competencia]);

  const ultimos12 = useMemo(() => {
    const arr: string[] = [];
    const [y, m] = competencia.split("-").map(Number);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return arr;
  }, [competencia]);

  return useQuery({
    queryKey: ["dre-profissional", competencia],
    queryFn: async () => {
      const calcularMes = async (comp: string): Promise<DREMensal> => {
        const [y, m] = comp.split("-").map(Number);
        const inicio = `${comp}-01`;
        const fim = new Date(y, m, 0).toISOString().slice(0, 10);

        const { data: oss } = await supabase
          .from("ordens_de_servico")
          .select("valor, valor_total, custo_pecas, data_conclusao")
          .in("status", ["pronto", "entregue"])
          .gte("data_conclusao", inicio)
          .lte("data_conclusao", fim)
          .is("deleted_at", null);

        const receitaBruta = (oss ?? []).reduce(
          (s, o: any) => s + Number(o.valor_total ?? o.valor ?? 0),
          0
        );
        const qtdOSs = (oss ?? []).length;
        const custoPecas = (oss ?? []).reduce(
          (s, o: any) => s + Number(o.custo_pecas ?? 0),
          0
        );

        const { data: com } = await supabase
          .from("comissoes")
          .select("valor, status, estornada_em, ordens_de_servico!inner(status,data_conclusao,deleted_at)")
          .is("estornada_em", null)
          .in("status", ["pendente", "liberada", "paga"])
          .is("ordens_de_servico.deleted_at", null)
          .in("ordens_de_servico.status", ["pronto", "entregue"])
          .gte("ordens_de_servico.data_conclusao", inicio)
          .lte("ordens_de_servico.data_conclusao", fim);
        const comissoes = (com ?? []).reduce((s, c: any) => s + Number(c.valor || 0), 0);

        const { data: prej } = await (supabase as any)
          .from("prejuizos")
          .select("valor_centavos")
          .is("deleted_at", null)
          .gte("data_evento", inicio)
          .lte("data_evento", fim);
        const prejuizosOperacionais = (prej ?? []).reduce(
          (s: number, p: any) => s + Number(p.valor_centavos || 0) / 100,
          0
        );

        const { data: contas } = await supabase
          .from("contas_a_pagar")
          .select("valor,recorrente,categoria")
          .eq("mes_competencia", comp)
          .is("deleted_at", null);
        const contasFiltradas = (contas ?? []).filter(
          (c: any) => c.categoria !== "Comissões" && c.categoria !== "Prejuízos"
        );
        const gastosFixos = contasFiltradas
          .filter((c: any) => c.recorrente === true)
          .reduce((s, c: any) => s + Number(c.valor || 0), 0);
        const outrosGastos = contasFiltradas
          .filter((c: any) => c.recorrente !== true)
          .reduce((s, c: any) => s + Number(c.valor || 0), 0);

        const impostos = 0;
        const receitaLiquida = receitaBruta - impostos;
        const lucroBruto = receitaLiquida - custoPecas - comissoes - prejuizosOperacionais;
        const ebitda = lucroBruto - gastosFixos - outrosGastos;
        const margemLiquida = receitaBruta > 0 ? (ebitda / receitaBruta) * 100 : 0;
        const ticketMedio = qtdOSs > 0 ? receitaBruta / qtdOSs : 0;

        return {
          competencia: comp,
          receitaBruta,
          impostos,
          receitaLiquida,
          custoPecas,
          comissoes,
          prejuizosOperacionais,
          lucroBruto,
          gastosFixos,
          outrosGastos,
          ebitda,
          margemLiquida,
          qtdOSs,
          ticketMedio,
        };
      };

      const [atual, ant, ...historico] = await Promise.all([
        calcularMes(competencia),
        calcularMes(anterior),
        ...ultimos12.map((c) => calcularMes(c)),
      ]);

      const [year, monthN] = competencia.split("-").map(Number);
      const ytdMeses = historico.filter((h) => {
        const [y, m] = h.competencia.split("-").map(Number);
        return y === year && m <= monthN;
      });
      const sum = (k: keyof DREMensal) =>
        ytdMeses.reduce((s, d) => s + Number(d[k] || 0), 0);
      const ytd: DREMensal = {
        competencia: `YTD-${year}`,
        receitaBruta: sum("receitaBruta"),
        impostos: sum("impostos"),
        receitaLiquida: sum("receitaLiquida"),
        custoPecas: sum("custoPecas"),
        comissoes: sum("comissoes"),
        prejuizosOperacionais: sum("prejuizosOperacionais"),
        lucroBruto: sum("lucroBruto"),
        gastosFixos: sum("gastosFixos"),
        outrosGastos: sum("outrosGastos"),
        ebitda: sum("ebitda"),
        margemLiquida: 0,
        qtdOSs: sum("qtdOSs"),
        ticketMedio: 0,
      };
      ytd.margemLiquida = ytd.receitaBruta > 0 ? (ytd.ebitda / ytd.receitaBruta) * 100 : 0;
      ytd.ticketMedio = ytd.qtdOSs > 0 ? ytd.receitaBruta / ytd.qtdOSs : 0;

      const ultimos3 = historico.slice(-3);
      const mediaMensal = ultimos3.reduce((s, d) => s + d.ebitda, 0) / Math.max(ultimos3.length, 1);
      const projecaoAnual = mediaMensal * 12;

      const variacao = {
        receitaBruta:
          ant.receitaBruta > 0
            ? ((atual.receitaBruta - ant.receitaBruta) / ant.receitaBruta) * 100
            : 0,
        ebitda: ant.ebitda !== 0 ? ((atual.ebitda - ant.ebitda) / Math.abs(ant.ebitda)) * 100 : 0,
        margem: atual.margemLiquida - ant.margemLiquida,
      };

      return { atual, anterior: ant, historico, ytd, projecaoAnual, variacao };
    },
  });
}
