import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Building2, Loader2, Store, Trash2, X, Mail, RotateCw } from "lucide-react";
import { toast } from "sonner";

async function enviarConviteGrupo(grupoId: string) {
  const { data, error } = await supabase.functions.invoke("convidar-grupo-lojista", {
    body: { grupo_id: grupoId },
  });
  if (error) throw error;
  if (data && !data.sucesso) throw new Error(data.erro || "Falha ao enviar convite");
  return data;
}

type Grupo = {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj_matriz: string | null;
  email: string | null;
  telefone: string | null;
  responsavel: string | null;
  observacoes: string | null;
  status_acesso: string | null;
  user_id: string | null;
  ativo: boolean;
  convite_enviado_em?: string | null;
  convite_aceito_em?: string | null;
};

type LojistaCliente = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  grupo_id: string | null;
};

export function ConfigGruposLojistasTab() {
  const { empresaId } = useEmpresa();
  const qc = useQueryClient();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Grupo | null>(null);

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ["lojista-grupos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lojista_grupos")
        .select("*")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Grupo[];
    },
  });

  const { data: lojistas = [] } = useQuery({
    queryKey: ["lojistas-clientes-b2b", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, email, telefone, grupo_id")
        .eq("tipo_cliente", "lojista_b2b")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as LojistaCliente[];
    },
  });

  function statusBadge(g: Grupo) {
    if (g.status_acesso === "ativo") return <Badge className="bg-success/10 text-success border-success/30">Acesso ativo</Badge>;
    if (g.status_acesso === "convidado") return <Badge className="bg-warning/10 text-warning border-warning/30">Convite enviado</Badge>;
    return <Badge variant="outline" className="text-muted-foreground">Sem convite</Badge>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Grupos permitem que <strong>1 login acesse várias lojas B2B</strong> (matriz / holding).
        </p>
        <Button size="sm" onClick={() => { setEditing(null); setOpenForm(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo Grupo
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : grupos.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum grupo cadastrado</p>
          <p className="text-xs text-muted-foreground">Crie um grupo para reunir várias lojas em um único login.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {grupos.map(g => {
            const qtdLojas = lojistas.filter(l => l.grupo_id === g.id).length;
            const podeConvidar = !!g.email && g.status_acesso !== "ativo";
            const ehReenvio = g.status_acesso === "convidado";
            return (
              <div
                key={g.id}
                onClick={() => { setEditing(g); setOpenForm(true); }}
                className="rounded-xl border bg-card p-4 text-left hover:border-primary/40 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">{g.nome}</span>
                  </div>
                  {statusBadge(g)}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {g.email && <p>📧 {g.email}</p>}
                  <p>🏪 {qtdLojas} {qtdLojas === 1 ? "loja vinculada" : "lojas vinculadas"}</p>
                </div>
                {podeConvidar && (
                  <div className="mt-3 pt-3 border-t">
                    <Button
                      size="sm"
                      variant={ehReenvio ? "outline" : "default"}
                      className="h-7 text-xs gap-1.5"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const res = await enviarConviteGrupo(g.id);
                          toast.success(res?.mensagem || "Convite enviado");
                          qc.invalidateQueries({ queryKey: ["lojista-grupos"] });
                        } catch (err: any) {
                          toast.error("Erro ao enviar convite: " + (err?.message || "desconhecido"));
                        }
                      }}
                    >
                      {ehReenvio ? <RotateCw className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                      {ehReenvio ? "Reenviar convite" : "Enviar convite"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <GrupoFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        grupo={editing}
        empresaId={empresaId}
        todosLojistas={lojistas}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["lojista-grupos"] });
          qc.invalidateQueries({ queryKey: ["lojistas-clientes-b2b"] });
          qc.invalidateQueries({ queryKey: ["lojistas-b2b-admin"] });
        }}
      />
    </div>
  );
}

function GrupoFormDialog({
  open, onOpenChange, grupo, empresaId, todosLojistas, onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  grupo: Grupo | null;
  empresaId: string | null | undefined;
  todosLojistas: LojistaCliente[];
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [razao, setRazao] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [adicionar, setAdicionar] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(grupo?.nome ?? "");
      setRazao(grupo?.razao_social ?? "");
      setCnpj(grupo?.cnpj_matriz ?? "");
      setEmail(grupo?.email ?? "");
      setTelefone(grupo?.telefone ?? "");
      setResponsavel(grupo?.responsavel ?? "");
      setObservacoes(grupo?.observacoes ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, grupo?.id]);


  const lojasNoGrupo = grupo ? todosLojistas.filter(l => l.grupo_id === grupo.id) : [];
  const lojasDisponiveis = todosLojistas.filter(l => !l.grupo_id);

  async function salvar() {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!empresaId) { toast.error("Empresa não identificada"); return; }
    setSaving(true);
    try {
      const payload: any = {
        nome: nome.trim(),
        razao_social: razao.trim() || null,
        cnpj_matriz: cnpj.trim() || null,
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        responsavel: responsavel.trim() || null,
        observacoes: observacoes.trim() || null,
      };
      if (grupo) {
        const { error } = await (supabase as any).from("lojista_grupos").update(payload).eq("id", grupo.id);
        if (error) throw error;
        toast.success("Grupo atualizado");
      } else {
        payload.empresa_id = empresaId;
        const { error } = await (supabase as any).from("lojista_grupos").insert(payload);
        if (error) throw error;
        toast.success("Grupo criado");
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function vincular(lojaId: string) {
    if (!grupo || !lojaId) return;
    const { error } = await supabase.from("clientes").update({ grupo_id: grupo.id } as any).eq("id", lojaId);
    if (error) { toast.error(error.message); return; }
    toast.success("Loja adicionada ao grupo");
    setAdicionar("");
    onSaved();
  }

  async function desvincular(lojaId: string) {
    const { error } = await supabase.from("clientes").update({ grupo_id: null } as any).eq("id", lojaId);
    if (error) { toast.error(error.message); return; }
    toast.success("Loja removida do grupo");
    onSaved();
  }

  async function excluir() {
    if (!grupo) return;
    if (!confirm("Excluir este grupo? As lojas vinculadas serão desassociadas.")) return;
    const { error: e1 } = await supabase.from("clientes").update({ grupo_id: null } as any).eq("grupo_id", grupo.id);
    if (e1) { toast.error(e1.message); return; }
    const { error } = await (supabase as any).from("lojista_grupos").update({ deleted_at: new Date().toISOString(), ativo: false }).eq("id", grupo.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Grupo excluído");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setNome(""); setRazao(""); setCnpj(""); setEmail(""); setTelefone(""); setResponsavel(""); setObservacoes(""); } onOpenChange(v); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            {grupo ? `Editar grupo: ${grupo.nome}` : "Novo Grupo de Lojistas"}
          </DialogTitle>
        </DialogHeader>

        {grupo && <ConviteSection grupo={grupo} onChanged={onSaved} />}

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome do grupo *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Bruspy Group" />
            </div>
            <div>
              <Label className="text-xs">Razão social</Label>
              <Input value={razao} onChange={e => setRazao(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">CNPJ matriz</Label>
              <Input value={cnpj} onChange={e => setCnpj(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Email (login do grupo)</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={telefone} onChange={e => setTelefone(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <Input value={responsavel} onChange={e => setResponsavel(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
          </div>

          {grupo && (
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Lojas vinculadas ({lojasNoGrupo.length})</Label>
              </div>
              {lojasNoGrupo.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma loja vinculada ainda</p>
              ) : (
                <div className="space-y-1.5">
                  {lojasNoGrupo.map(l => (
                    <div key={l.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Store className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{l.nome}</span>
                        {l.email && <span className="text-muted-foreground">— {l.email}</span>}
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => desvincular(l.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Select value={adicionar} onValueChange={setAdicionar}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="+ Adicionar loja existente" />
                  </SelectTrigger>
                  <SelectContent>
                    {lojasDisponiveis.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma loja sem grupo</div>
                    ) : lojasDisponiveis.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-8" disabled={!adicionar} onClick={() => vincular(adicionar)}>
                  Adicionar
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {grupo && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={excluir}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={salvar} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
