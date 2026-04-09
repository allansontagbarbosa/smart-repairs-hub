import { useState } from "react";
import { Pencil, Trash2, Plus, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props { statusOrdem: any[] }

export function ConfigStatusTab({ statusOrdem }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ nome: "", cor: "#6b7280", ordem_exibicao: 0, ativo: true });

  const reset = () => { setForm({ nome: "", cor: "#6b7280", ordem_exibicao: 0, ativo: true }); setEditId(null); };

  const handleSave = async () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    const payload = { ...form, ordem_exibicao: Number(form.ordem_exibicao) || 0 };
    if (editId) { await supabase.from("status_ordem_servico").update(payload).eq("id", editId); }
    else { await supabase.from("status_ordem_servico").insert(payload); }
    qc.invalidateQueries({ queryKey: ["status_ordem_servico"] });
    toast.success("Salvo"); setOpen(false); reset();
  };

  const handleEdit = (s: any) => {
    setForm({ nome: s.nome, cor: s.cor || "#6b7280", ordem_exibicao: s.ordem_exibicao, ativo: s.ativo });
    setEditId(s.id); setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("status_ordem_servico").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["status_ordem_servico"] });
    toast.success("Removido");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Status da Ordem de Serviço</CardTitle>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Novo Status</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Editar" : "Novo"} Status</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm((p: any) => ({ ...p, nome: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cor</Label><Input type="color" value={form.cor} onChange={(e) => setForm((p: any) => ({ ...p, cor: e.target.value }))} className="h-10" /></div>
                  <div><Label>Ordem de exibição</Label><Input type="number" value={form.ordem_exibicao} onChange={(e) => setForm((p: any) => ({ ...p, ordem_exibicao: e.target.value }))} /></div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => setForm((p: any) => ({ ...p, ativo: v }))} /><Label>Ativo</Label></div>
                <Button onClick={handleSave} className="w-full">{editId ? "Salvar" : "Cadastrar"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {statusOrdem.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: s.cor || "#6b7280" }} />
                  <span className="text-sm font-medium">{s.nome}</span>
                  <span className="text-xs text-muted-foreground">#{s.ordem_exibicao}</span>
                  {!s.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(s)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(s.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              </div>
            ))}
            {statusOrdem.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">Nenhum status cadastrado</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
