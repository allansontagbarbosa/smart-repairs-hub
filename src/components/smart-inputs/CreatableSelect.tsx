import { useState } from "react";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Option {
  id: string;
  nome: string;
}

interface CreatableSelectProps {
  value: string;
  onValueChange: (id: string) => void;
  options: Option[];
  onCreateNew: (nome: string) => Promise<string | null>; // returns new id
  placeholder?: string;
  label?: string;
  entityName?: string;
}

export function CreatableSelect({ value, onValueChange, options, onCreateNew, placeholder = "Selecione", label, entityName = "item" }: CreatableSelectProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const newId = await onCreateNew(newName.trim());
    setSaving(false);
    if (newId) {
      onValueChange(newId);
      setDialogOpen(false);
      setNewName("");
    }
  };

  return (
    <div>
      {label && <Label>{label}</Label>}
      <Select value={value} onValueChange={(v) => {
        if (v === "__create_new__") { setDialogOpen(true); return; }
        onValueChange(v);
      }}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
          ))}
          <SelectItem value="__create_new__" className="text-primary font-medium">
            <span className="flex items-center gap-1"><Plus className="h-3.5 w-3.5" />Adicionar {entityName}</span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo {entityName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`Nome do ${entityName}`} autoFocus onKeyDown={(e) => e.key === "Enter" && handleCreate()} /></div>
            <Button onClick={handleCreate} disabled={saving || !newName.trim()} className="w-full">{saving ? "Salvando..." : "Criar e selecionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
