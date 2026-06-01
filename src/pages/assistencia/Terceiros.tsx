import { useState } from "react";
import { useTerceiros, useSalvarTerceiro, type Terceiro } from "@/hooks/useTerceirizacao";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Loader2, UserCog } from "lucide-react";

export default function Terceiros() {
  const { data: lista = [], isLoading } = useTerceiros();
  const salvar = useSalvarTerceiro();
  const [editing, setEditing] = useState<Partial<Terceiro> | null>(null);

  const open = editing !== null;

  const handleSubmit = async () => {
    if (!editing?.nome?.trim()) return;
    await salvar.mutateAsync({
      id: editing.id,
      nome: editing.nome.trim(),
      contato: editing.contato ?? null,
      especialidade: editing.especialidade ?? null,
      observacoes: editing.observacoes ?? null,
      ativo: editing.ativo ?? true,
    });
    setEditing(null);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" />
            Terceiros
          </h1>
          <p className="text-sm text-muted-foreground">
            Técnicos e assistências externas para quem você envia aparelhos.
          </p>
        </div>
        <Button onClick={() => setEditing({ ativo: true })}>
          <Plus className="h-4 w-4 mr-1" /> Novo terceiro
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : lista.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <UserCog className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum terceiro cadastrado ainda.</p>
            <p className="text-xs mt-1">Cadastre os parceiros que você envia aparelhos para reparo externo.</p>
          </div>
        ) : (
          <div className="divide-y">
            {lista.map(t => (
              <div key={t.id} className="flex items-center justify-between p-4 hover:bg-muted/40">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{t.nome}</span>
                    {!t.ativo && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                    {t.especialidade && <Badge variant="secondary" className="text-xs">{t.especialidade}</Badge>}
                  </div>
                  {t.contato && <div className="text-xs text-muted-foreground mt-0.5">{t.contato}</div>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar terceiro" : "Novo terceiro"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={editing.nome ?? ""} onChange={e => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Contato</Label>
                  <Input value={editing.contato ?? ""} onChange={e => setEditing({ ...editing, contato: e.target.value })} placeholder="WhatsApp/telefone" />
                </div>
                <div className="space-y-1.5">
                  <Label>Especialidade</Label>
                  <Input value={editing.especialidade ?? ""} onChange={e => setEditing({ ...editing, especialidade: e.target.value })} placeholder="microsoldagem, placa…" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea rows={2} value={editing.observacoes ?? ""} onChange={e => setEditing({ ...editing, observacoes: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.ativo ?? true} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} />
                <Label>Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!editing?.nome?.trim() || salvar.isPending}>
              {salvar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
