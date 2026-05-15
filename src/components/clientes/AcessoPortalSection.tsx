import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Copy, MessageCircle, Loader2, ShieldCheck, Clock, XCircle, Mail, MailCheck, Send,
} from "lucide-react";
import {
  useCriarConvite, useEnviarConviteEmail, useRevogarConvite,
  type ClienteConviteRow,
} from "@/hooks/useConviteCliente";
import { toast } from "sonner";

const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL as string | undefined) ?? "https://portal.ditt.com.br";

interface Props {
  clienteId: string;
  clienteNome: string;
  clienteEmail?: string | null;
  clienteTelefone?: string | null;
  tipoCliente: "lojista_b2b" | "consumidor_b2c";
  convite?: ClienteConviteRow | null;
}

const dt = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function AcessoPortalSection({ clienteId, clienteNome, clienteEmail, clienteTelefone, tipoCliente, convite }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState(clienteEmail ?? "");
  const criar = useCriarConvite();
  const enviarEmail = useEnviarConviteEmail();
  const revogar = useRevogarConvite();

  useEffect(() => {
    setEmailInput(convite?.email ?? clienteEmail ?? "");
  }, [convite?.email, clienteEmail]);

  if (tipoCliente !== "lojista_b2b") return null;

  const link = (token: string) => `${PORTAL_URL}/aceitar-convite/${token}`;
  const ocupado = criar.isPending || enviarEmail.isPending;

  function abrirModal() {
    setEmailInput(convite?.email ?? clienteEmail ?? "");
    setModalOpen(true);
  }

  async function handleConfirmar() {
    const email = emailInput.trim();
    if (!EMAIL_RE.test(email)) {
      toast.error("Email inválido");
      return;
    }
    try {
      const r = await criar.mutateAsync({ clienteId, email });
      if (r.success) {
        setModalOpen(false);
        await enviarEmail.mutateAsync(clienteId);
      }
    } catch {
      // erros já tostados nos hooks
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

  // ───── Estado: aceito ─────
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

  // ───── Estado: pendente ─────
  if (convite?.status_convite === "pendente" && convite.convite_token) {
    const token = convite.convite_token;
    return (
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Acesso ao portal</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Clock className="h-4 w-4 text-warning" />
            <span className="font-medium text-foreground">Convite pendente</span>
            <span className="text-xs text-muted-foreground">
              · Para {convite.email ?? "—"} · expira {dt(convite.convite_expira_em)}
            </span>
          </div>
          {convite.convite_email_enviado_em && (
            <div className="flex items-center gap-2 text-xs text-success">
              <MailCheck className="h-3.5 w-3.5" />
              Email enviado em {dt(convite.convite_email_enviado_em)}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => enviarEmail.mutate(clienteId)}
              disabled={enviarEmail.isPending}
              className="gap-2"
            >
              {enviarEmail.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {convite.convite_email_enviado_em ? "Reenviar email" : "Enviar email"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => copiarLink(token)}>
              <Copy className="h-3.5 w-3.5 mr-2" /> Copiar
            </Button>
            <Button size="sm" variant="outline" onClick={() => abrirWhatsApp(token)}>
              <MessageCircle className="h-3.5 w-3.5 mr-2" /> WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={abrirModal} disabled={criar.isPending}>
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

  // ───── Sem convite / revogado / expirado ─────
  const semEmail = !convite?.email && !clienteEmail;

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
              Vamos pedir o email e mandar o convite automaticamente.
            </p>
          </div>
          <Button onClick={abrirModal} disabled={ocupado} className="gap-2">
            <Mail className="h-4 w-4" />
            Convidar pra portal
          </Button>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={(o) => !ocupado && setModalOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar {clienteNome}</DialogTitle>
            <DialogDescription>
              {semEmail
                ? "Esse cliente não tem email cadastrado. Informe um agora pra receber o convite."
                : "Confirme o email pra onde o convite será enviado."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="email-convite">Email do lojista</Label>
            <Input
              id="email-convite"
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="contato@lojista.com.br"
              disabled={ocupado}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              O email é salvo no cadastro do cliente e usado pra criar a conta no portal.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={ocupado}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmar} disabled={ocupado} className="gap-2">
              {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
              {criar.isPending ? "Criando…" : enviarEmail.isPending ? "Enviando email…" : "Enviar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
