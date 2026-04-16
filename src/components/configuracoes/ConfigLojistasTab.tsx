import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Building2, Plus, Store, Send, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

type DialogStep = "form" | "access";

export function ConfigLojistasTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [step, setStep] = useState<DialogStep>("form");
  const [savedLojistaId, setSavedLojistaId] = useState<string | null>(null);
  const [accessEmail, setAccessEmail] = useState("");
  const [accessSent, setAccessSent] = useState(false);

  const [nome, setNome] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const { data: lojistas = [], isLoading } = useQuery({
    queryKey: ["lojistas-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojistas")
        .select("*")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data;
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
      const payload = { nome, razao_social: razaoSocial || null, cnpj: cnpj || null, telefone: telefone || null, whatsapp: whatsapp || null, email: email || null, responsavel: responsavel || null, observacoes: observacoes || null };
      if (editing) {
        const { error } = await supabase.from("lojistas").update(payload).eq("id", editing.id);
        if (error) throw error;
        return editing.id as string;
      } else {
        const { data, error } = await supabase.from("lojistas").insert(payload).select("id").single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: (lojistaId: string) => {
      queryClient.invalidateQueries({ queryKey: ["lojistas-admin"] });
      if (editing) {
        toast.success("Lojista atualizado!");
        closeDialog();
      } else {
        toast.success("Lojista cadastrado!");
        setSavedLojistaId(lojistaId);
        setAccessEmail(email || "");
        setAccessSent(false);
        setStep("access");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("lojistas").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lojistas-admin"] }),
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

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sendAccessMutation = useMutation({
    mutationFn: async () => {
      if (!savedLojistaId || !accessEmail.trim()) 
        throw new Error("Email obrigatório");

      // 1. Enviar magic link — sem criar user_profile
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: accessEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/lojista`,
        },
      });
      if (otpError) throw new Error(otpError.message);

      // 2. Salvar o email no cadastro do lojista
      const { error: updateErr } = await supabase
        .from("lojistas")
        .update({ email: accessEmail })
        .eq("id", savedLojistaId);
      if (updateErr) throw updateErr;

      // 3. Verificar se já tem registro em lojista_usuarios
      const { data: existing } = await supabase
        .from("lojista_usuarios")
        .select("id")
        .eq("lojista_id", savedLojistaId)
        .eq("email", accessEmail)
        .maybeSingle();

      // Se não existe, criar com placeholder (vínculo definitivo no login)
      if (!existing) {
        await supabase.from("lojista_usuarios").insert({
          lojista_id: savedLojistaId,
          user_id: "00000000-0000-0000-0000-000000000000",
          nome: responsavel || nome,
          email: accessEmail,
          ativo: false,
        } as any);
      }

      return accessEmail;
    },
    onSuccess: (sentEmail) => {
      setAccessSent(true);
      toast.success(`Convite enviado para ${sentEmail}`);
      queryClient.invalidateQueries({ queryKey: ["lojistas-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setStep("form");
    setSavedLojistaId(null);
    setAccessEmail("");
    setAccessSent(false);
    setNome(""); setRazaoSocial(""); setCnpj(""); setTelefone(""); setWhatsapp(""); setEmail(""); setResponsavel(""); setObservacoes("");
    setDialogOpen(true);
  }

  function openEdit(l: any) {
    setEditing(l);
    setStep("form");
    setNome(l.nome); setRazaoSocial(l.razao_social || ""); setCnpj(l.cnpj || ""); setTelefone(l.telefone || ""); setWhatsapp(l.whatsapp || ""); setEmail(l.email || ""); setResponsavel(l.responsavel || ""); setObservacoes(l.observacoes || "");
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
    setStep("form");
    setSavedLojistaId(null);
    setAccessSent(false);
  }

  const portalUrl = `${window.location.origin}/lojista/login`;

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
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">CNPJ</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Responsável</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">OS</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Ativo</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lojistas.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{l.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{l.cnpj || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{l.responsavel || "—"}</td>
                  <td className="px-4 py-3 text-center">{(osCounts as any)[l.id] || 0}</td>
                  <td className="px-4 py-3 text-center">
                    <Switch
                      checked={l.ativo}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: l.id, ativo: v })}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(l)} className="h-7 text-xs">
                        Editar
                      </Button>
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
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancelar
            </Button>
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

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {step === "access" ? "Acesso ao portal" : editing ? "Editar lojista" : "Novo lojista"}
            </DialogTitle>
          </DialogHeader>

          {step === "form" ? (
            <>
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
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
                <Button onClick={() => saveMutation.mutate()} disabled={!nome.trim() || saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="space-y-4">
              {!accessSent ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Envie o acesso ao portal B2B para o responsável da loja <strong>{nome}</strong>.
                  </p>
                  <div className="space-y-1">
                    <Label>Email do responsável *</Label>
                    <Input
                      type="email"
                      value={accessEmail}
                      onChange={(e) => setAccessEmail(e.target.value)}
                      placeholder="responsavel@loja.com"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={closeDialog}>Pular</Button>
                    <Button
                      onClick={() => sendAccessMutation.mutate()}
                      disabled={!accessEmail.trim() || sendAccessMutation.isPending}
                      className="gap-1.5"
                    >
                      {sendAccessMutation.isPending ? (
                        <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Enviar acesso
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <div className="text-center space-y-3 py-4">
                  <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Convite enviado para <strong>{accessEmail}</strong></p>
                    <p className="text-xs text-muted-foreground">
                      O lojista pode acessar o portal em:
                    </p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block mt-1">{portalUrl}</code>
                  </div>
                  <Button onClick={closeDialog} className="mt-4">Concluir</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}