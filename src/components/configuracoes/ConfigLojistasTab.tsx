import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Store, Send, Loader2, ShieldCheck, ShieldOff, MailPlus, RotateCw,
  ExternalLink, ArrowRight,
} from "lucide-react";
import { useCriarConvite, useEnviarConviteEmail, useRevogarConvite } from "@/hooks/useConviteCliente";

type LojistaB2B = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  status_convite: "pendente" | "aceito" | "revogado" | "expirado" | null;
  convite_aceito_em: string | null;
  convite_enviado_em: string | null;
  grupo_id: string | null;
  lojista_grupos: { nome: string } | null;
};

export function ConfigLojistasTab() {
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const criarConvite = useCriarConvite();
  const enviarEmail = useEnviarConviteEmail();
  const revogar = useRevogarConvite();

  const { data: lojistas = [], isLoading } = useQuery({
    queryKey: ["lojistas-b2b-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, email, telefone, status_convite, convite_aceito_em, convite_enviado_em, grupo_id, lojista_grupos(nome)")
        .eq("tipo_cliente", "lojista_b2b")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as LojistaB2B[];
    },
  });


  async function handleEnviarConvite(l: LojistaB2B) {
    if (!l.email) return;
    setBusyId(l.id);
    try {
      // Se ainda não tem convite, cria primeiro
      if (l.status_convite !== "pendente" && l.status_convite !== "aceito") {
        await criarConvite.mutateAsync({ clienteId: l.id, email: l.email });
      }
      await enviarEmail.mutateAsync(l.id);
    } catch {
      // toasts já são exibidos pelos hooks
    } finally {
      setBusyId(null);
    }
  }

  async function handleReenviar(l: LojistaB2B) {
    setBusyId(l.id);
    try {
      await enviarEmail.mutateAsync(l.id);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevogar(id: string) {
    setBusyId(id);
    try {
      await revogar.mutateAsync(id);
    } finally {
      setBusyId(null);
      setConfirmRevokeId(null);
    }
  }

  function StatusBadge({ l }: { l: LojistaB2B }) {
    if (l.status_convite === "aceito") {
      return (
        <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10">
          <ShieldCheck className="h-3 w-3 mr-1" /> Acesso ativo
        </Badge>
      );
    }
    if (l.status_convite === "pendente") {
      return (
        <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10">
          <MailPlus className="h-3 w-3 mr-1" /> Convite pendente
        </Badge>
      );
    }
    if (l.status_convite === "revogado") {
      return (
        <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
          <ShieldOff className="h-3 w-3 mr-1" /> Acesso revogado
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Sem convite
      </Badge>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Lojistas B2B (clientes com tipo <strong>lojista</strong>) e gerência de acesso ao portal
        </p>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link to="/clientes">
            <ExternalLink className="h-4 w-4" />
            Cadastrar em Clientes
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : lojistas.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Store className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum lojista B2B cadastrado</p>
          <p className="text-xs text-muted-foreground">
            Cadastre em <strong>Clientes</strong> e marque o tipo como <strong>lojista</strong>.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">Telefone</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Acesso</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Grupo</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {lojistas.map((l) => {
                const busy = busyId === l.id;
                const semEmail = !l.email;
                return (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to={`/clientes/${l.id}`} className="font-medium hover:underline inline-flex items-center gap-1">
                        {l.nome}
                        <ArrowRight className="h-3 w-3 opacity-50" />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{l.email || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{l.telefone || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge l={l} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {(!l.status_convite || l.status_convite === "revogado" || l.status_convite === "expirado") && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleEnviarConvite(l)}
                            disabled={busy || semEmail}
                            title={semEmail ? "Cadastre o email do cliente antes" : undefined}
                          >
                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Enviar convite
                          </Button>
                        )}

                        {l.status_convite === "pendente" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleReenviar(l)}
                            disabled={busy}
                          >
                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                            Reenviar email
                          </Button>
                        )}

                        {l.status_convite === "aceito" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                            onClick={() => setConfirmRevokeId(l.id)}
                            disabled={busy}
                          >
                            <ShieldOff className="h-3 w-3" />
                            Revogar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!confirmRevokeId} onOpenChange={() => setConfirmRevokeId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revogar acesso</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            O lojista perderá o acesso ao Portal imediatamente. Você pode enviar um novo convite depois.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevokeId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => confirmRevokeId && handleRevogar(confirmRevokeId)}
            >
              Revogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
