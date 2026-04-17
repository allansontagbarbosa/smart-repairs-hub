import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2, Plus, Store, Send, CheckCircle2, Trash2, Loader2, Copy,
  ShieldCheck, ShieldOff, MailPlus, RotateCw,
} from "lucide-react";
import { toast } from "sonner";

type Lojista = {
  id: string;
  nome: string;
  email: string | null;
  cnpj: string | null;
  responsavel: string | null;
  status_acesso: "nao_convidado" | "convidado" | "ativo" | "inativo";
  convite_enviado_em: string | null;
  convite_aceito_em: string | null;
};

export function ConfigLojistasTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const [nome, setNome] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteResultUrl, setInviteResultUrl] = useState<string | null>(null);
  const [inviteResultEmail, setInviteResultEmail] = useState<string>("");
  const [inviteResultEmailQueued, setInviteResultEmailQueued] = useState(false);

  const { data: lojistas = [], isLoading } = useQuery({
    queryKey: ["lojistas-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojistas")
        .select("id, nome, email, cnpj, responsavel, status_acesso, convite_enviado_em, convite_aceito_em, ativo")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data as any[] as Lojista[];
    },
  });

  const { data: osCounts = {} } = useQuery({
    queryKey: ["lojistas-os-count"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ordens_de_servico")
        .select("lojista_id")
        .not("lojista_id", "is", null)
        .is("deleted_at", null);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((o: any) => {
        counts[o.lojista_id] = (counts[o.lojista_id] || 0) + 1;
      });
      return counts;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome,
        razao_social: razaoSocial || null,
        cnpj: cnpj || null,
        telefone: telefone || null,
        whatsapp: whatsapp || null,
        email: email || null,
        responsavel: responsavel || null,
        observacoes: observacoes || null,
      };
      if (editing) {
        const { error } = await supabase.from("lojistas").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lojistas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lojistas-admin"] });
      toast.success(editing ? "Lojista atualizado!" : "Lojista cadastrado!");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lojistas")
        .update({ deleted_at: new Date().toISOString(), ativo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lojistas-admin"] });
      toast.success("Lojista removido!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function enviarConvite(lojista: Lojista) {
    if (!lojista.email) {
      toast.error("Cadastre o email do lojista antes de enviar o convite.");
      return;
    }
    setInvitingId(lojista.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-lojista-invite", {
        body: { lojista_id: lojista.id },
      });
      if (error || !(data as any)?.ok) {
        throw new Error((data as any)?.error ?? error?.message ?? "Erro ao enviar convite");
      }
      setInviteResultUrl((data as any).accept_url);
      setInviteResultEmail((data as any).email ?? lojista.email ?? "");
      setInviteResultEmailQueued(Boolean((data as any).email_queued));
      queryClient.invalidateQueries({ queryKey: ["lojistas-admin"] });
      toast.success("Convite gerado!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar convite");
    } finally {
      setInvitingId(null);
    }
  }

  async function revogar(id: string) {
    const { error } = await supabase
      .from("lojistas")
      .update({ status_acesso: "inativo" })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    // desativar também o vínculo em lojista_usuarios
    await supabase.from("lojista_usuarios").update({ ativo: false }).eq("lojista_id", id);
    toast.success("Acesso revogado.");
    queryClient.invalidateQueries({ queryKey: ["lojistas-admin"] });
  }

  async function reativar(id: string) {
    const { error } = await supabase
      .from("lojistas")
      .update({ status_acesso: "ativo" })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("lojista_usuarios").update({ ativo: true }).eq("lojista_id", id);
    toast.success("Acesso reativado.");
    queryClient.invalidateQueries({ queryKey: ["lojistas-admin"] });
  }

  function openNew() {
    setEditing(null);
    setNome(""); setRazaoSocial(""); setCnpj(""); setTelefone(""); setWhatsapp(""); setEmail(""); setResponsavel(""); setObservacoes("");
    setDialogOpen(true);
  }

  function openEdit(l: any) {
    setEditing(l);
    setNome(l.nome); setRazaoSocial(l.razao_social || ""); setCnpj(l.cnpj || ""); setTelefone(l.telefone || ""); setWhatsapp(l.whatsapp || ""); setEmail(l.email || ""); setResponsavel(l.responsavel || ""); setObservacoes(l.observacoes || "");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  function StatusBadge({ l }: { l: Lojista }) {
    const status = l.status_acesso ?? "nao_convidado";
    if (status === "ativo") {
      return (
        <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10">
          <ShieldCheck className="h-3 w-3 mr-1" /> Ativo
        </Badge>
      );
    }
    if (status === "convidado") {
      const enviado = l.convite_enviado_em ? new Date(l.convite_enviado_em) : null;
      const expira = enviado ? Math.max(0, 7 - Math.floor((Date.now() - enviado.getTime()) / 86400000)) : null;
      return (
        <div className="flex flex-col items-start gap-0.5">
          <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10">
            <MailPlus className="h-3 w-3 mr-1" /> Aguardando aceite
          </Badge>
          {expira !== null && (
            <span className="text-[10px] text-muted-foreground">
              Expira em {expira} {expira === 1 ? "dia" : "dias"}
            </span>
          )}
        </div>
      );
    }
    if (status === "inativo") {
      return (
        <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
          <ShieldOff className="h-3 w-3 mr-1" /> Inativo
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Não convidado
      </Badge>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gerencie lojistas parceiros B2B</p>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo lojista
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center">
          <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : lojistas.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Store className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum lojista cadastrado</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Email</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">OS</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Acesso</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lojistas.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{l.nome}</div>
                    {l.responsavel && <div className="text-xs text-muted-foreground">{l.responsavel}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{l.email || "—"}</td>
                  <td className="px-4 py-3 text-center">{(osCounts as any)[l.id] || 0}</td>
                  <td className="px-4 py-3"><StatusBadge l={l} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(l)} className="h-7 text-xs">
                        Editar
                      </Button>

                      {(l.status_acesso === "nao_convidado" || !l.status_acesso) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => enviarConvite(l)}
                          disabled={invitingId === l.id}
                        >
                          {invitingId === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          Enviar convite
                        </Button>
                      )}

                      {l.status_acesso === "convidado" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => enviarConvite(l)}
                          disabled={invitingId === l.id}
                        >
                          {invitingId === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                          Reenviar
                        </Button>
                      )}

                      {l.status_acesso === "ativo" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                          onClick={() => setConfirmRevokeId(l.id)}
                        >
                          <ShieldOff className="h-3 w-3" />
                          Revogar
                        </Button>
                      )}

                      {l.status_acesso === "inativo" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => reativar(l.id)}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          Reativar
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDeleteId(l.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Diálogo de resultado do convite */}
      <Dialog open={!!inviteResultUrl} onOpenChange={() => setInviteResultUrl(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Convite gerado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm">
              {inviteResultEmailQueued
                ? <>O convite foi enviado por email para <strong>{inviteResultEmail}</strong>.</>
                : <>O convite foi gerado. Como ainda não há serviço de email configurado, copie o link abaixo e envie manualmente para <strong>{inviteResultEmail}</strong>.</>}
            </p>
            <div className="space-y-1">
              <Label>Link de aceite (válido por 7 dias)</Label>
              <div className="flex gap-2">
                <Input readOnly value={inviteResultUrl ?? ""} className="text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteResultUrl ?? "");
                    toast.success("Link copiado!");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setInviteResultUrl(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar revogação */}
      <Dialog open={!!confirmRevokeId} onOpenChange={() => setConfirmRevokeId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revogar acesso</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            O lojista perderá o acesso ao Portal imediatamente. Você pode reativar depois.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevokeId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmRevokeId) {
                  revogar(confirmRevokeId);
                  setConfirmRevokeId(null);
                }
              }}
            >
              Revogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir lojista</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Tem certeza que deseja excluir este lojista? Esta ação não pode ser desfeita.
            As OS vinculadas a ele não serão afetadas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (confirmDeleteId) {
                  deleteMutation.mutate(confirmDeleteId);
                  setConfirmDeleteId(null);
                }
              }}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo cadastro/edição */}
      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {editing ? "Editar lojista" : "Novo lojista"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome fantasia" />
            </div>
            <div className="space-y-1">
              <Label>Razão Social</Label>
              <Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>CNPJ</Label>
              <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>WhatsApp</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Após salvar, use o botão <strong>Enviar convite</strong> na lista para liberar o acesso ao portal.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!nome.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
