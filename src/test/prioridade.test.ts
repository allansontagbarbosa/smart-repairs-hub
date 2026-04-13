import { describe, it, expect } from "vitest";
import { calcularPrioridade } from "@/lib/prioridade";

describe("calcularPrioridade", () => {
  it("retorna normal para OS entregue", () => {
    const result = calcularPrioridade("entregue", new Date().toISOString(), null);
    expect(result.nivel).toBe("normal");
  });

  it("retorna critica para prazo vencido", () => {
    const ontem = new Date(Date.now() - 86400000).toISOString();
    const result = calcularPrioridade("em_reparo", new Date().toISOString(), ontem);
    expect(result.nivel).toBe("critica");
  });

  it("retorna atencao para prazo em 1 dia", () => {
    const amanha = new Date(Date.now() + 86400000).toISOString();
    const result = calcularPrioridade("em_reparo", new Date().toISOString(), amanha);
    expect(result.nivel).toBe("atencao");
  });

  it("retorna critica para OS parada há mais de 5 dias sem previsão", () => {
    const sesDiasAtras = new Date(Date.now() - 6 * 86400000).toISOString();
    const result = calcularPrioridade("em_analise", sesDiasAtras, null);
    expect(result.nivel).toBe("critica");
  });

  it("retorna normal para OS recém criada sem previsão", () => {
    const result = calcularPrioridade("recebido", new Date().toISOString(), null);
    expect(result.nivel).toBe("normal");
  });
});
