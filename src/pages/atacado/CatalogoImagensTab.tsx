import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Image as ImageIcon, Plus, Trash2, Pencil, Smartphone, AlertCircle } from "lucide-react";

type Row = {
  id: string;
  modelo: string;
  cor: string | null;
  imagem_url: string;
  updated_at: string;
};

type Variante = {
  modelo: string;
  cor: string | null;
  qtd: number;
};

export default function CatalogoImagensTab() {
  const { empresaId } = useEmpresa();
  const qc = useQueryClient();
  const [editar, setEditar] = useState<Partial<Row> | null>(null);

  const imgsQ = useQuery({
    queryKey: ["catalogo-imagens", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atacado_catalogo_imagens" as any)
        .select("id, modelo, cor, imagem_url, updated_at")
        .order("modelo")
        .order("cor", { nullsFirst: true });
      if (error) throw error;
      return (data as unknown as Row[]) ?? [];
    },
    enabled: !!empresaId,
  });

  // variantes em estoque (modelo + cor distintos)
  const varsQ = useQuery({
    queryKey: ["catalogo-variantes-estoque", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atacado_aparelhos")
        .select("modelo, cor, quantidade")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .gt("quantidade", 0);
      if (error) throw error;
      const map = new Map<string, Variante>();
      for (const r of (data ?? []) as any[]) {
        const k = `${r.modelo}||${r.cor ?? ""}`;
        const cur = map.get(k);
        if (cur) cur.qtd += r.quantidade;
        else map.set(k, { modelo: r.modelo, cor: r.cor, qtd: r.quantidade });
      }
      return Array.from(map.values()).sort((a, b) =>
        a.modelo.localeCompare(b.modelo) || (a.cor ?? "").localeCompare(b.cor ?? ""),
      );
    },
    enabled: !!empresaId,
  });

  const modelosUnicos = Array.from(
    new Set((varsQ.data ?? []).map((v) => v.modelo)),
  ).sort();

  const removerMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("atacado_catalogo_imagens" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogo-imagens"] });
      toast.success("Imagem removida");
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const imgsByKey = new Map<string, Row>();
  for (const r of imgsQ.data ?? []) {
    imgsByKey.set(`${r.modelo}||${r.cor ?? ""}`, r);
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-start gap-3 border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20">
        <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <p className="font-medium">Direitos de imagem</p>
          <p>
            Use fotos próprias padronizadas ou de fonte autorizada (catálogo de fornecedor com direito de uso).
            Fotos oficiais da Apple são copyright da Apple — não use sem autorização.
          </p>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Imagens por modelo</h3>
          <p className="text-xs text-muted-foreground">
            Padronize a vitrine: uma imagem por modelo (e, se quiser, uma por cor).
          </p>
        </div>
        <Button size="sm" onClick={() => setEditar({})}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar imagem
        </Button>
      </div>

      {/* Variantes em estoque sem imagem */}
      <Card className="p-4 space-y-2">
        <h4 className="text-sm font-semibold">Variantes em estoque</h4>
        {varsQ.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (varsQ.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem aparelhos em estoque no momento.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {(varsQ.data ?? []).map((v) => {
              const img =
                imgsByKey.get(`${v.modelo}||${v.cor ?? ""}`) ??
                imgsByKey.get(`${v.modelo}||`);
              const especifica = imgsByKey.get(`${v.modelo}||${v.cor ?? ""}`);
              return (
                <button
                  key={`${v.modelo}-${v.cor ?? "_"}`}
                  type="button"
                  className="border rounded-lg p-2 text-left hover:border-primary transition-colors"
                  onClick={() => setEditar(
                    especifica ?? { modelo: v.modelo, cor: v.cor, imagem_url: img?.imagem_url ?? "" }
                  )}
                >
                  <div className="aspect-square bg-muted rounded mb-2 flex items-center justify-center overflow-hidden">
                    {img ? (
                      <img src={img.imagem_url} alt={v.modelo} loading="lazy"
                        className="w-full h-full object-contain" />
                    ) : (
                      <Smartphone className="h-8 w-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <p className="text-xs font-medium truncate">{v.modelo}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {v.cor ?? "—"} · {v.qtd} un
                  </p>
                  {especifica ? (
                    <Badge variant="default" className="mt-1 text-[9px] h-4">Foto da cor</Badge>
                  ) : img ? (
                    <Badge variant="secondary" className="mt-1 text-[9px] h-4">Foto do modelo</Badge>
                  ) : (
                    <Badge variant="outline" className="mt-1 text-[9px] h-4">Sem foto</Badge>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Lista de imagens definidas */}
      <Card className="p-4 space-y-2">
        <h4 className="text-sm font-semibold">Imagens definidas ({(imgsQ.data ?? []).length})</h4>
        {imgsQ.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (imgsQ.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma imagem cadastrada ainda.</p>
        ) : (
          <div className="divide-y">
            {(imgsQ.data ?? []).map((r) => (
              <div key={r.id} className="py-2 flex items-center gap-3">
                <div className="h-12 w-12 bg-muted rounded overflow-hidden shrink-0">
                  <img src={r.imagem_url} alt={r.modelo} loading="lazy"
                    className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.modelo}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.cor ? `Cor: ${r.cor}` : "Padrão (todas as cores)"}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEditar(r)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon" variant="ghost"
                  onClick={() => {
                    if (confirm("Remover esta imagem?")) removerMut.mutate(r.id);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <EditarImagemDialog
        edit={editar}
        onClose={() => setEditar(null)}
        modelosEstoque={modelosUnicos}
        coresPorModelo={Object.fromEntries(
          modelosUnicos.map((m) => [
            m,
            Array.from(new Set(
              (varsQ.data ?? []).filter((v) => v.modelo === m && v.cor).map((v) => v.cor as string),
            )).sort(),
          ]),
        )}
        empresaId={empresaId!}
        onSaved={() => qc.invalidateQueries({ queryKey: ["catalogo-imagens"] })}
      />
    </div>
  );
}

function EditarImagemDialog({
  edit, onClose, modelosEstoque, coresPorModelo, empresaId, onSaved,
}: {
  edit: Partial<Row> | null;
  onClose: () => void;
  modelosEstoque: string[];
  coresPorModelo: Record<string, string[]>;
  empresaId: string;
  onSaved: () => void;
}) {
  const [modelo, setModelo] = useState(edit?.modelo ?? "");
  const [cor, setCor] = useState<string>(edit?.cor ?? "__padrao");
  const [url, setUrl] = useState(edit?.imagem_url ?? "");
  const [saving, setSaving] = useState(false);

  // reset when opening
  useState(() => {
    setModelo(edit?.modelo ?? "");
    setCor(edit?.cor ?? "__padrao");
    setUrl(edit?.imagem_url ?? "");
  });

  if (!edit) return null;

  const salvar = async () => {
    if (!modelo.trim()) return toast.error("Informe o modelo");
    if (!url.trim()) return toast.error("Informe a URL da imagem");
    try {
      new URL(url);
    } catch {
      return toast.error("URL inválida (use https://…)");
    }
    setSaving(true);
    try {
      const payload: any = {
        empresa_id: empresaId,
        modelo: modelo.trim(),
        cor: cor === "__padrao" ? null : cor,
        imagem_url: url.trim(),
        updated_at: new Date().toISOString(),
      };
      if (edit.id) {
        const { error } = await supabase
          .from("atacado_catalogo_imagens" as any)
          .update(payload)
          .eq("id", edit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("atacado_catalogo_imagens" as any)
          .upsert(payload, {
            onConflict: cor === "__padrao"
              ? "empresa_id,modelo"
              : "empresa_id,modelo,cor",
          });
        if (error) throw error;
      }
      toast.success("Imagem salva");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const coresDoModelo = coresPorModelo[modelo] ?? [];

  return (
    <Dialog open={!!edit} onOpenChange={(b) => { if (!b) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{edit.id ? "Editar imagem" : "Adicionar imagem"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Modelo</Label>
            {modelosEstoque.length > 0 ? (
              <Select value={modelo} onValueChange={setModelo}>
                <SelectTrigger><SelectValue placeholder="Escolha o modelo" /></SelectTrigger>
                <SelectContent>
                  {modelosEstoque.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={modelo} onChange={(e) => setModelo(e.target.value)} />
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cor (opcional)</Label>
            <Select value={cor} onValueChange={setCor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__padrao">Padrão (todas as cores)</SelectItem>
                {coresDoModelo.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Foto da cor específica aparece primeiro; sem ela, usa a foto padrão do modelo.
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL da imagem (https)</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://meucdn.com/iphone-16-pro.jpg"
            />
            <p className="text-[10px] text-muted-foreground">
              Use sua própria hospedagem (ex.: CDN, Imgur, S3, Drive público). Recomendamos fotos quadradas (1:1) com fundo neutro.
            </p>
          </div>
          {url && (
            <div className="aspect-square bg-muted rounded overflow-hidden flex items-center justify-center">
              <img
                src={url}
                alt="Pré-visualização"
                className="max-w-full max-h-full object-contain"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
