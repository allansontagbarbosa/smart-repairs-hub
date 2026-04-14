import { useState } from "react";
import { Pencil, Save, Eye, Plus, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const variables = [
  "{cliente}", "{marca}", "{modelo}", "{defeito}", "{diagnostico}",
  "{servico}", "{valor}", "{numero}", "{data}", "{tecnico}", "{telefone}",
];

const sampleData: Record<string, string> = {
  "{cliente}": "João Silva",
  "{marca}": "Apple",
  "{modelo}": "iPhone 15 Pro",
  "{defeito}": "Tela trincada",
  "{diagnostico}": "Display LCD danificado, necessita substituição",
  "{servico}": "Troca de tela",
  "{valor}": "R$ 450,00",
  "{numero}": "003",
  "{data}": "14/04/2026",
  "{tecnico}": "Carlos Lima",
  "{telefone}": "(11) 99999-9999",
};

function replaceVars(text: string): string {
  let result = text;
  Object.entries(sampleData).forEach(([key, val]) => {
    result = result.replaceAll(key, val);
  });
  return result;
}

export function ConfigDocumentosTab({ modelosDocumento }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [previewing, setPreviewing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>({});

  const handleEdit = (d: any) => {
    setForm({ titulo: d.titulo, tipo: d.tipo, cabecalho: d.cabecalho || "", corpo: d.corpo || "", rodape: d.rodape || "", observacoes: d.observacoes || "", ativo: d.ativo });
    setEditing(d);
    setCreating(false);
  };

  const handleNew = () => {
    setForm({ titulo: "", tipo: "ordem_servico", cabecalho: "", corpo: "", rodape: "", observacoes: "", ativo: true });
    setEditing(null);
    setCreating(true);
  };

  const handleSave = async () => {
    if (!form.titulo) { toast.error("Título é obrigatório"); return; }
    if (editing) {
      await supabase.from("modelos_documento").update(form).eq("id", editing.id);
    } else {
      await supabase.from("modelos_documento").insert(form);
    }
    qc.invalidateQueries({ queryKey: ["modelos_documento"] });
    toast.success(editing ? "Modelo atualizado" : "Modelo criado");
    setEditing(null);
    setCreating(false);
  };

  const handlePrint = (d: any) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${d.titulo}</title><style>body{font-family:sans-serif;padding:40px;max-width:800px;margin:0 auto}h1{text-align:center;border-bottom:2px solid #333;padding-bottom:10px}footer{border-top:1px solid #ccc;padding-top:10px;margin-top:30px;font-size:12px;color:#666}</style></head><body>`);
    w.document.write(`<h1>${replaceVars(d.cabecalho || d.titulo)}</h1>`);
    w.document.write(`<div style="white-space:pre-line;margin:20px 0">${replaceVars(d.corpo || "")}</div>`);
    if (d.observacoes) w.document.write(`<div style="font-style:italic;color:#666;margin:10px 0">${replaceVars(d.observacoes)}</div>`);
    w.document.write(`<footer>${replaceVars(d.rodape || "")}</footer>`);
    w.document.write(`</body></html>`);
    w.document.close();
    w.print();
  };

  const dialogOpen = !!editing || creating;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Configure os modelos de documentos. Use variáveis como {variables.slice(0, 4).join(", ")}.</p>
        <Button size="sm" onClick={handleNew}><Plus className="h-4 w-4 mr-1" />Novo Modelo</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modelosDocumento.map((d) => (
          <Card key={d.id} className={!d.ativo ? "opacity-60" : ""}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">{d.titulo}</CardTitle>
                <Badge variant="outline" className="text-[10px] mt-1">{tipoLabels[d.tipo] || d.tipo}</Badge>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePrint(d)} title="Imprimir"><Printer className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewing(d)}><Eye className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(d)}><Pencil className="h-3 w-3" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground line-clamp-2">{d.cabecalho}</p>
            </CardContent>
          </Card>
        ))}
        {modelosDocumento.length === 0 && <p className="text-sm text-muted-foreground col-span-2 text-center py-8">Nenhum modelo de documento cadastrado</p>}
      </div>

      {/* Edit / Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setEditing(null); setCreating(false); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Modelo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm((p: any) => ({ ...p, titulo: e.target.value }))} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((p: any) => ({ ...p, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(tipoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Cabeçalho</Label><Textarea value={form.cabecalho} onChange={(e) => setForm((p: any) => ({ ...p, cabecalho: e.target.value }))} rows={2} /></div>
            <div><Label>Corpo</Label><Textarea value={form.corpo} onChange={(e) => setForm((p: any) => ({ ...p, corpo: e.target.value }))} rows={6} /></div>
            <div><Label>Rodapé</Label><Textarea value={form.rodape} onChange={(e) => setForm((p: any) => ({ ...p, rodape: e.target.value }))} rows={2} /></div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm((p: any) => ({ ...p, observacoes: e.target.value }))} rows={2} /></div>
            <div>
              <Label className="text-xs text-muted-foreground">Variáveis disponíveis</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {variables.map((v) => <span key={v} className="px-2 py-0.5 text-xs rounded-md bg-muted">{v}</span>)}
              </div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.ativo !== false} onCheckedChange={(v) => setForm((p: any) => ({ ...p, ativo: v }))} /><Label>Ativo</Label></div>
            <Button onClick={handleSave} className="w-full"><Save className="h-4 w-4 mr-1" />Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewing} onOpenChange={(v) => !v && setPreviewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Pré-visualização: {previewing?.titulo}</DialogTitle></DialogHeader>
          <div className="border rounded-lg p-6 space-y-4 bg-card">
            <div className="text-center font-bold text-lg border-b pb-3">{replaceVars(previewing?.cabecalho || "")}</div>
            <div className="text-sm whitespace-pre-line">{replaceVars(previewing?.corpo || "")}</div>
            {previewing?.observacoes && <div className="text-xs text-muted-foreground italic">{replaceVars(previewing.observacoes)}</div>}
            <div className="text-xs text-muted-foreground border-t pt-3">{replaceVars(previewing?.rodape || "")}</div>
          </div>
          <Button variant="outline" onClick={() => handlePrint(previewing)} className="w-full gap-1.5"><Printer className="h-4 w-4" />Imprimir</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
