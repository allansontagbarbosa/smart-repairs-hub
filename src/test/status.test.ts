import { describe, it, expect } from "vitest";
import { statusLabels, statusFlow } from "@/lib/status";

describe("statusLabels", () => {
  it("contém todos os 8 status", () => {
    expect(Object.keys(statusLabels)).toHaveLength(8);
  });

  it("statusFlow tem todos os status em ordem correta", () => {
    expect(statusFlow[0]).toBe("recebido");
    expect(statusFlow[statusFlow.length - 1]).toBe("entregue");
  });

  it("todos os status do flow têm label definida", () => {
    statusFlow.forEach(status => {
      expect(statusLabels[status]).toBeTruthy();
    });
  });
});
