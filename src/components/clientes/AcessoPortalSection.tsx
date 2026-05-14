import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Copy, MessageCircle, Loader2, ShieldCheck, Clock, XCircle, Mail } from "lucide-react";
import {
  useClienteConvite, useCriarConvite, useRevogarConvite,
} from "@/hooks/useConviteCliente";
import { toast } from "sonner";

const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL as string | undefined) ?? "https://portal.ditt.com";

interface Props {
  clienteId: string;
  clienteNome: string;
  clienteTelefone?: string | null;
  tipoCliente: "lojista_b2b" | "consumidor_b2c";
}

const dt = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

export function AcessoPortalSection({ clienteId, clienteNome, clienteTelefone, tipoCliente }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [tokenAtual, setTokenAtual] = useState<string | null>(null);
  const { data: convite } = useClienteConvite(clienteId);
  const criar = useCriarConvite();
  const revogar = useRevogarConvite();

  if (tipoCliente !== "lojista_b2b") return null;

  const link = (token: string) => `${PORTAL_URL}/aceitar-convite/${token}`;

  async function gerar() {
    const r = await criar.mutateAsync(clienteId);
    if (r.token) {
      setTokenAtual(r.token);
      setModalOpen(true);
    }
  }

  function copiarLink(token: string) {
    navigator.clipboard.writeText(link(token));
    toast.success("Link copiado");
  }

  function abrirWhatsApp(token: string) {
    const msg = `Olá ${clienteNome}! Acesso ao portal Ditt: ${link(token)} (válido por 7 dias)`;
    const fone = (clienteTelefone ?? "").replace(/\D/g, "");
    const url = fone
      ? `https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  // Estado: já aceitou
  if (convite?.status_convite === "aceito" && convite.user_id) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Acesso ao portal</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            <span className="font-medium text-success">Acesso ativo</span>
            <span className="text-xs text-muted-foreground">· Aceito em {dt(convite.convite_aceito_em)}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => revogar.mutate(clienteId)}
            disabled={revogar.isPending}
          >
            {revogar.isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <XCircle className="h-3.5 w-3.5 mr-2" />}
            Revogar acesso
          </Button>
        </div>
      </div>
    );
  }

  // Estado: convite pendente
  if (convite?.status_convite === "pendente" && convite.convite_token) {
    const token = convite.convite_token;
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Acesso ao portal</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <span className="font-medium text-foreground">Convite pendente</span>
            <span className="text-xs text-muted-foreground">
              · Enviado {dt(convite.convite_enviado_em)} · Expira {dt(convite.convite_expira_em)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => copiarLink(token)}>
              <Copy className="h-3.5 w-3.5 mr-2" /> Copiar link
            </Button>
            <Button size="sm" variant="outline" onClick={() => abrirWhatsApp(token)}>
              <MessageCircle className="h-3.5 w-3.5 mr-2" /> WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={gerar} disabled={criar.isPending}>
              {criar.isPending && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              Gerar novo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => revogar.mutate(clienteId)}
              disabled={revogar.isPending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Sem convite / revogado / expirado
  return (
    <>
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Acesso ao portal</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">Sem convite enviado</p>
            <p className="text-xs text-muted-foreground mt-1">
              {convite?.status_convite === "revogado" && "Acesso revogado anteriormente. "}
              {convite?.status_convite === "expirado" && "Convite anterior expirou. "}
              Gere um link de convite pra esse lojista acessar o portal.
            </p>
          </div>
          <Button onClick={gerar} disabled={criar.isPending} className="gap-2">
            {criar.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Gerando…</>
            ) : (
              <><Mail className="h-4 w-4" /> Convidar pra portal</>
            )}
          </Button>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convite gerado</DialogTitle>
            <DialogDescription>
              Link válido por 7 dias. Compartilhe com {clienteNome} via WhatsApp ou copie pra enviar como preferir.
            </DialogDescription>
          </DialogHeader>
          {tokenAtual && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/50 p-3 font-mono text-xs break-all">
                {link(tokenAtual)}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => abrirWhatsApp(tokenAtual)} className="gap-2">
                  <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
                </Button>
                <Button variant="outline" onClick={() => copiarLink(tokenAtual)} className="gap-2">
                  <Copy className="h-4 w-4" /> Copiar link
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
