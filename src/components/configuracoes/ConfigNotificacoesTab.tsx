import { useState } from "react";
import { Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props { templatesMensagem: any[] }

const eventLabels: Record<string, string> = {
  recebido: "Aparelho Recebido",
  orcamento_pronto: "Orçamento Pronto",
  servico_concluido: "Serviço Concluído",
  pronto_retirada: "Pronto para Retirada",
};

export function ConfigNotificacoesTab({ templatesMensagem }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const handleEdit = (t: any) => {
    setForm({ titulo: t.titulo, mensagem: t.mensagem, ativo: t.ativo });
    setEditing(t);
  };

  const handleSave = async () => {
    if (!editing) return;
    await supabase.from("templates_mensagem").update(form).eq("id", editing.id);
    qc.invalidateQueries({ queryKey: ["templates_mensagem"] });
    toast.success("Template atualizado");
    setEditing(null);
  };

  const toggleAtivo = async (t: any) => {
    await supabase.from("templates_mensagem").update({ ativo: !t.ativo }).eq("id", t.id);
    qc.invalidateQueries({ queryKey: ["templates_mensagem"] });
    toast.success(t.ativo ? "Desativado" : "Ativado");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Configure os templates de mensagem para cada evento do sistema. Use variáveis como {"{cliente}"}, {"{aparelho}"}, {"{status}"}, {"{numero}"} nos templates.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templatesMensagem.map((t) => (
          <Card key={t.id}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">{t.titulo}</CardTitle>
                <p className="text-xs text-muted-foreground">{eventLabels[t.evento] || t.evento}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={t.ativo} onCheckedChange={() => toggleAtivo(t)} />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(t)}><Pencil className="h-3 w-3" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-3">{t.mensagem}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Mensagem</Label><Textarea value={form.mensagem || ""} onChange={(e) => setForm((p: any) => ({ ...p, mensagem: e.target.value }))} rows={6} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => setForm((p: any) => ({ ...p, ativo: v }))} /><Label>Ativo</Label></div>
            <Button onClick={handleSave} className="w-full"><Save className="h-4 w-4 mr-1" />Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
