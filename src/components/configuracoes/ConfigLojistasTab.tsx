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
import { Building2, Plus, Store, Eye } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function ConfigLojistasTab() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  // Form state
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

  // Get OS count per lojista
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

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("lojistas").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lojistas-admin"] }),
  });

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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
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
