import { useState, useRef } from "react";
import { Pencil, Save, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props { templatesMensagem: any[] }

const eventColors: Record<string, string> = {
  recebido: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  orcamento_pronto: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  servico_concluido: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  pronto_retirada: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  garantia_vencendo: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  aprovacao: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
};

const variables = [
  { label: "{cliente}", desc: "Nome do cliente" },
  { label: "{aparelho}", desc: "Marca e modelo" },
  { label: "{numero}", desc: "Número da OS" },
  { label: "{valor}", desc: "Valor do serviço" },
  { label: "{previsao}", desc: "Previsão de entrega" },
  { label: "{tecnico}", desc: "Técnico responsável" },
  { label: "{defeito}", desc: "Defeito relatado" },
  { label: "{link_portal}", desc: "Link do portal" },
];

export function ConfigNotificacoesTab({ templatesMensagem }: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleEdit = (t: any) => {
    setForm({ titulo: t.titulo, mensagem: t.mensagem, ativo: t.ativo, evento: t.evento });
    setEditing(t);
    setCreating(false);
  };

  const handleNew = () => {
    setForm({ titulo: "", mensagem: "", ativo: true, evento: "recebido" });
    setEditing(null);
    setCreating(true);
  };

  const handleSave = async () => {
    if (!form.titulo || !form.mensagem) { toast.error("Título e mensagem são obrigatórios"); return; }
    if (editing) {
      await supabase.from("templates_mensagem").update({ titulo: form.titulo, mensagem: form.mensagem, ativo: form.ativo }).eq("id", editing.id);
    } else {
      await supabase.from("templates_mensagem").insert({ titulo: form.titulo, mensagem: form.mensagem, ativo: form.ativo, evento: form.evento });
    }
    qc.invalidateQueries({ queryKey: ["templates_mensagem"] });
    toast.success(editing ? "Template atualizado" : "Template criado");
    setEditing(null);
    setCreating(false);
  };

  const toggleAtivo = async (t: any) => {
    await supabase.from("templates_mensagem").update({ ativo: !t.ativo }).eq("id", t.id);
    qc.invalidateQueries({ queryKey: ["templates_mensagem"] });
    toast.success(t.ativo ? "Desativado" : "Ativado");
  };

  const insertVariable = (variable: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setForm((p: any) => ({ ...p, mensagem: (p.mensagem || "") + variable }));
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = form.mensagem || "";
    const newText = text.substring(0, start) + variable + text.substring(end);
    setForm((p: any) => ({ ...p, mensagem: newText }));
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + variable.length;
    }, 0);
  };

  const dialogOpen = !!editing || creating;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Configure os templates de mensagem para cada evento do sistema.</p>
        <Button size="sm" onClick={handleNew}><Plus className="h-4 w-4 mr-1" />Novo Template</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templatesMensagem.map((t) => (
          <Card key={t.id}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">{t.titulo}</CardTitle>
                <Badge className={`text-[10px] mt-1 ${eventColors[t.evento] || "bg-muted text-muted-foreground"}`} variant="secondary">
                  {t.evento}
                </Badge>
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

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setEditing(null); setCreating(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Template" : "Novo Template"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.titulo || ""} onChange={(e) => setForm((p: any) => ({ ...p, titulo: e.target.value }))} /></div>
            {creating && (
              <div>
                <Label>Evento</Label>
                <Select value={form.evento} onValueChange={(v) => setForm((p: any) => ({ ...p, evento: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recebido">Recebido</SelectItem>
                    <SelectItem value="orcamento_pronto">Orçamento Pronto</SelectItem>
                    <SelectItem value="servico_concluido">Serviço Concluído</SelectItem>
                    <SelectItem value="pronto_retirada">Pronto para Retirada</SelectItem>
                    <SelectItem value="garantia_vencendo">Garantia Vencendo</SelectItem>
                    <SelectItem value="aprovacao">Aprovação</SelectItem>
                    <SelectItem value="custom">Customizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Mensagem</Label>
              <Textarea ref={textareaRef} value={form.mensagem || ""} onChange={(e) => setForm((p: any) => ({ ...p, mensagem: e.target.value }))} rows={6} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Variáveis disponíveis (clique para inserir)</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {variables.map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => insertVariable(v.label)}
                    className="px-2 py-0.5 text-xs rounded-md bg-muted hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                    title={v.desc}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => setForm((p: any) => ({ ...p, ativo: v }))} /><Label>Ativo</Label></div>
            <Button onClick={handleSave} className="w-full"><Save className="h-4 w-4 mr-1" />Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
