import { describe, it, expect, vi, beforeEach } from "vitest";

describe("abrirWhatsApp", () => {
  beforeEach(() => {
    window.open = vi.fn();
  });

  it("adiciona o código 55 se não tiver", async () => {
    const { abrirWhatsApp } = await import("@/lib/whatsapp");
    abrirWhatsApp("11999990000", "Olá!");
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("5511999990000"),
      "_blank"
    );
  });

  it("não duplica o código 55 se já tiver", async () => {
    const { abrirWhatsApp } = await import("@/lib/whatsapp");
    abrirWhatsApp("5511999990000", "Olá!");
    const url = (window.open as any).mock.calls[0][0];
    expect(url).not.toContain("555511");
  });

  it("remove caracteres não numéricos do telefone", async () => {
    const { abrirWhatsApp } = await import("@/lib/whatsapp");
    abrirWhatsApp("(11) 99999-0000", "teste");
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("5511999990000"),
      "_blank"
    );
  });
});
