import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { abrirWhatsApp } from "@/lib/whatsapp";
import type { ClienteSaldoResumo } from "@/hooks/useClientesSaldos";

const fmtCurrency = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d.includes("T") ? d : `${d}T00:00:00`).toLocaleDateString("pt-BR") : "—";

interface Props {
  cliente: ClienteSaldoResumo | null;
  onClose: () => void;
}

function buildMensagem(opts: {
  primeiroNome: string;
  saldo: number;
  ultimaOsData: string | null;
  nomeEmpresa: string;
}) {
  return [
    `Olá, ${opts.primeiroNome}! Tudo bem?`,
    "",
    `Aqui é da ${opts.nomeEmpresa}.`,
    "",
    `Estou passando para lembrar que há um saldo em aberto de ${fmtCurrency(opts.saldo)} referente aos serviços realizados${opts.ultimaOsData ? ` (última OS em ${fmtDate(opts.ultimaOsData)})` : ""}.`,
    "",
    "Pode me confirmar a melhor forma de regularizar?",
    "Aceito PIX, dinheiro ou cartão.",
    "",
    "Obrigado!",
  ].join("\n");
}

export function CobrarClienteDialog({ cliente, onClose }: Props) {
  const [mensagem, setMensagem] = useState("");

  const { data: empresaConfig } = useQuery({
    queryKey: ["empresa-config-nome"],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresa_config")
        .select("nome")
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const nomeEmpresa = empresaConfig?.nome ?? "loja";

  const numeroAlvo = useMemo(() => {
    if (!cliente) return "";
    return (cliente.whatsapp || cliente.telefone || "").replace(/\D/g, "");
  }, [cliente]);

  const podeEnviar = !!cliente && numeroAlvo.length >= 10 && mensagem.trim().length > 0;

  useEffect(() => {
    if (!cliente) {
      setMensagem("");
      return;
    }
    const primeiroNome = cliente.nome.trim().split(/\s+/)[0] ?? cliente.nome;
    setMensagem(
      buildMensagem({
        primeiroNome,
        saldo: Number(cliente.saldo_devedor ?? 0),
        ultimaOsData: cliente.ultima_os_data,
        nomeEmpresa,
      })
    );
  }, [cliente, nomeEmpresa]);

  const handleEnviar = () => {
    if (!cliente || !podeEnviar) return;
    abrirWhatsApp(numeroAlvo, mensagem);
    onClose();
  };

  if (!cliente) return null;

  const numeroFormatado = cliente.whatsapp || cliente.telefone || "—";

  return (
    <Dialog open={!!cliente} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Cobrar {cliente.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 rounded-md border bg-muted/30 p-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Saldo devedor</p>
              <p className="text-sm font-semibold text-destructive">{fmtCurrency(cliente.saldo_devedor)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Última OS</p>
              <p className="text-sm">{fmtDate(cliente.ultima_os_data)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Enviando para</p>
              <p className="text-sm font-mono">{numeroFormatado}</p>
              {numeroAlvo.length < 10 && (
                <p className="text-[11px] text-destructive mt-0.5">Telefone inválido ou não cadastrado.</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="msg-cobranca">Mensagem</Label>
            <Textarea
              id="msg-cobranca"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={10}
              className="mt-1.5 resize-none font-mono text-[12px] leading-relaxed"
              placeholder="Escreva a mensagem de cobrança..."
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Você pode editar antes de enviar. {mensagem.length} caracteres.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleEnviar} disabled={!podeEnviar} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
            <Send className="h-3.5 w-3.5" />
            Abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
