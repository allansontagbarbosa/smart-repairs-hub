import { useState } from "react";
import { Pencil, Save, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props { modelosDocumento: any[] }

const tipoLabels: Record<string, string> = {
  laudo: "Laudo Técnico",
  recibo: "Recibo de Entrega",
  ordem_servico: "Ordem de Serviço",
  orcamento: "Orçamento",
};

export function ConfigDocumentosTab({ modelosDocumento }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [previewing, setPreviewing] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const handleEdit = (d: any) => {
    setForm({ titulo: d.titulo, cabecalho: d.cabecalho || "", corpo: d.corpo || "", rodape: d.rodape || "", observacoes: d.observacoes || "" });
    setEditing(d);
  };

  const handleSave = async () => {
    if (!editing) return;
    await supabase.from("modelos_documento").update(form).eq("id", editing.id);
    qc.invalidateQueries({ queryKey: ["modelos_documento"] });
    toast.success("Modelo atualizado");
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Configure os modelos de documentos utilizados no sistema. Use variáveis como {"{cliente}"}, {"{marca}"}, {"{modelo}"}, {"{defeito}"}, {"{diagnostico}"}, {"{servico}"}, {"{valor}"}, {"{numero}"}.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modelosDocumento.map((d) => (
          <Card key={d.id}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">{d.titulo}</CardTitle>
                <Badge variant="outline" className="text-[10px] mt-1">{tipoLabels[d.tipo] || d.tipo}</Badge>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewing(d)}><Eye className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(d)}><Pencil className="h-3 w-3" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground line-clamp-2">{d.cabecalho}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Modelo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm((p: any) => ({ ...p, titulo: e.target.value }))} /></div>
            <div><Label>Cabeçalho</Label><Textarea value={form.cabecalho} onChange={(e) => setForm((p: any) => ({ ...p, cabecalho: e.target.value }))} rows={2} /></div>
            <div><Label>Corpo</Label><Textarea value={form.corpo} onChange={(e) => setForm((p: any) => ({ ...p, corpo: e.target.value }))} rows={6} /></div>
            <div><Label>Rodapé</Label><Textarea value={form.rodape} onChange={(e) => setForm((p: any) => ({ ...p, rodape: e.target.value }))} rows={2} /></div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm((p: any) => ({ ...p, observacoes: e.target.value }))} rows={2} /></div>
            <Button onClick={handleSave} className="w-full"><Save className="h-4 w-4 mr-1" />Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewing} onOpenChange={(v) => !v && setPreviewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Pré-visualização: {previewing?.titulo}</DialogTitle></DialogHeader>
          <div className="border rounded-lg p-6 space-y-4 bg-card">
            <div className="text-center font-bold text-lg border-b pb-3">{previewing?.cabecalho}</div>
            <div className="text-sm whitespace-pre-line">{previewing?.corpo}</div>
            {previewing?.observacoes && <div className="text-xs text-muted-foreground italic">{previewing?.observacoes}</div>}
            <div className="text-xs text-muted-foreground border-t pt-3">{previewing?.rodape}</div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
