import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Camera, FileSignature, Trash2, Upload, Wrench, User, Phone, Smartphone } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTecnicoIdentidade } from "@/hooks/useTecnico";
import { AssinaturaCanvas } from "@/components/tecnico/AssinaturaCanvas";
import { statusLabels } from "@/lib/status";

const DEFAULT_CHECKLIST = [
  { key: "touch", label: "Touch responde corretamente" },
  { key: "tela", label: "Tela sem defeitos visuais" },
  { key: "camera_traseira", label: "Câmera traseira funcionando" },
  { key: "camera_frontal", label: "Câmera frontal funcionando" },
  { key: "alto_falante", label: "Alto-falante e auricular OK" },
  { key: "microfone", label: "Microfone OK" },
  { key: "wifi", label: "Wi-Fi conectando" },
  { key: "carga", label: "Carregamento funcionando" },
  { key: "botoes", label: "Botões físicos respondendo" },
];

const STATUS_OPCOES = ["em_analise", "aguardando_pecas", "em_reparo", "pronto", "entregue"];

export default function TecnicoOrdemDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: identidade } = useTecnicoIdentidade();

  const { data: ordem, isLoading } = useQuery({
    queryKey: ["tecnico-os", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_de_servico")
        .select(`*, aparelhos ( marca, modelo, cor, imei, clientes ( nome, telefone, whatsapp ) )`)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: checklist = [], refetch: refetchChecklist } = useQuery({
    queryKey: ["tecnico-checklist", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_checklist_saida")
        .select("*")
        .eq("ordem_id", id!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: fotos = [], refetch: refetchFotos } = useQuery({
    queryKey: ["tecnico-fotos", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_fotos")
        .select("*")
        .eq("ordem_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: assinaturas = [], refetch: refetchAssinaturas } = useQuery({
    queryKey: ["tecnico-assinaturas", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assinaturas_digitais")
        .select("*")
        .eq("ordem_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Inicializa checklist se vazio
  useEffect(() => {
    if (!id || !ordem || checklist.length > 0) return;
    (async () => {
      if (!identidade?.empresa_id) return;
      const rows = DEFAULT_CHECKLIST.map(i => ({
        ordem_id: id,
        item_key: i.key,
        item_label: i.label,
        testado: false,
        empresa_id: identidade.empresa_id!,
      }));
      await supabase.from("os_checklist_saida").insert(rows);
      refetchChecklist();
    })();
  }, [id, ordem, checklist.length, refetchChecklist]);

  const updateOS = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("ordens_de_servico").update(patch).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Atualizado" });
      qc.invalidateQueries({ queryKey: ["tecnico-os", id] });
      qc.invalidateQueries({ queryKey: ["tecnico-minhas-os"] });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const toggleItem = async (item: any) => {
    const novo = !item.testado;
    await supabase
      .from("os_checklist_saida")
      .update({
        testado: novo,
        testado_em: novo ? new Date().toISOString() : null,
        testado_por: novo ? identidade?.user_id : null,
      })
      .eq("id", item.id);
    refetchChecklist();
  };

  const updateObs = async (item: any, observacao: string) => {
    await supabase.from("os_checklist_saida").update({ observacao }).eq("id", item.id);
    refetchChecklist();
  };

  const handleUpload = async (file: File, tipo: string) => {
    if (!identidade?.empresa_id || !id) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${identidade.empresa_id}/${id}/${tipo}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("os-fotos").upload(path, file);
    if (upErr) {
      toast({ title: "Falha no upload", description: upErr.message, variant: "destructive" });
      return;
    }
    const { error: insErr } = await supabase.from("os_fotos").insert({
      ordem_id: id,
      tipo,
      url_storage: path,
      uploaded_by: identidade.user_id,
      empresa_id: identidade.empresa_id!,
    });
    if (insErr) toast({ title: "Erro ao salvar foto", description: insErr.message, variant: "destructive" });
    else {
      toast({ title: "Foto enviada" });
      refetchFotos();
    }
  };

  const removerFoto = async (foto: any) => {
    await supabase.storage.from("os-fotos").remove([foto.url_storage]);
    await supabase.from("os_fotos").delete().eq("id", foto.id);
    refetchFotos();
  };

  const checklistCompleto = checklist.length > 0 && checklist.every(c => c.testado);

  if (isLoading || !ordem) {
    return <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>;
  }

  const cliente = (ordem.aparelhos as any)?.clientes;
  const aparelho = ordem.aparelhos as any;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-mono text-muted-foreground">#{ordem.numero_formatado || ordem.numero}</p>
          <h1 className="text-lg font-semibold truncate">{aparelho?.marca} {aparelho?.modelo}</h1>
        </div>
        <Badge variant="outline">{statusLabels[ordem.status as keyof typeof statusLabels] ?? ordem.status}</Badge>
      </div>

      {/* Resumo */}
      <Card>
        <CardContent className="p-3 space-y-2 text-sm">
          <Row icon={User} label={cliente?.nome || "—"} />
          <Row icon={Phone} label={cliente?.whatsapp || cliente?.telefone || "—"} />
          <Row icon={Smartphone} label={`${aparelho?.cor || ""} ${aparelho?.imei ? `· IMEI ${aparelho.imei}` : ""}`} />
          {ordem.defeito_relatado && (
            <p className="pt-2 border-t text-muted-foreground">
              <span className="font-medium text-foreground">Defeito:</span> {ordem.defeito_relatado}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Status técnico rápido */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Atualizar status</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={ordem.status} onValueChange={v => updateOS.mutate({ status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPCOES.map(s => (
                <SelectItem key={s} value={s}>{statusLabels[s as keyof typeof statusLabels] ?? s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <Label className="text-xs">Tipo de serviço executado</Label>
            <Input
              defaultValue={ordem.tipo_servico || ""}
              placeholder="Ex: troca_tela, troca_bateria"
              onBlur={e => {
                const v = e.target.value.trim() || null;
                if (v !== ordem.tipo_servico) updateOS.mutate({ tipo_servico: v });
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="checklist">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="fotos">Fotos</TabsTrigger>
          <TabsTrigger value="assinaturas">Assinaturas</TabsTrigger>
        </TabsList>

        <TabsContent value="checklist" className="space-y-2 pt-3">
          {checklist.map(item => (
            <Card key={item.id}>
              <CardContent className="p-3 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={item.testado} onCheckedChange={() => toggleItem(item)} />
                  <span className={`text-sm flex-1 ${item.testado ? "line-through text-muted-foreground" : ""}`}>
                    {item.item_label}
                  </span>
                </label>
                <Textarea
                  placeholder="Observação (opcional)"
                  defaultValue={item.observacao || ""}
                  className="text-xs min-h-[36px]"
                  onBlur={e => {
                    if (e.target.value !== (item.observacao || "")) updateObs(item, e.target.value);
                  }}
                />
              </CardContent>
            </Card>
          ))}
          {!checklistCompleto && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              Conclua todos os itens antes da assinatura final.
            </p>
          )}
        </TabsContent>

        <TabsContent value="fotos" className="space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-2">
            {(["antes", "depois", "defeito", "peca"] as const).map(tipo => (
              <UploadFotoButton key={tipo} tipo={tipo} onPick={handleUpload} />
            ))}
          </div>
          {fotos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma foto enviada.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {fotos.map((f: any) => <FotoTile key={f.id} foto={f} onDelete={() => removerFoto(f)} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assinaturas" className="space-y-3 pt-3">
          <AssinaturasSection
            ordemId={id!}
            empresaId={identidade?.empresa_id || null}
            tecnicoNome={identidade?.nome || ""}
            assinaturas={assinaturas}
            onChange={refetchAssinaturas}
            checklistCompleto={checklistCompleto}
          />
        </TabsContent>
      </Tabs>

      <Link to="/tecnico/transferencias">
        <Button variant="outline" className="w-full">
          <Wrench className="h-4 w-4 mr-2" /> Pedir transferência desta OS
        </Button>
      </Link>
    </div>
  );
}

function Row({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function UploadFotoButton({ tipo, onPick }: { tipo: string; onPick: (f: File, tipo: string) => void }) {
  const id = `up-${tipo}`;
  return (
    <label htmlFor={id} className="cursor-pointer">
      <div className="border border-dashed rounded-md py-3 text-center hover:bg-accent/30 transition-colors">
        <Camera className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
        <p className="text-xs capitalize">{tipo}</p>
      </div>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onPick(f, tipo);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function FotoTile({ foto, onDelete }: { foto: any; onDelete: () => void }) {
  const url = useMemo(() => {
    return supabase.storage.from("os-fotos").getPublicUrl(foto.url_storage).data.publicUrl;
  }, [foto.url_storage]);
  const [signed, setSigned] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("os-fotos").createSignedUrl(foto.url_storage, 3600).then(r => setSigned(r.data?.signedUrl ?? url));
  }, [foto.url_storage, url]);
  return (
    <div className="relative group rounded-md overflow-hidden border">
      {signed && <img src={signed} alt={foto.tipo} className="w-full aspect-square object-cover" />}
      <Badge className="absolute top-1 left-1 capitalize text-[10px]">{foto.tipo}</Badge>
      <Button
        variant="destructive" size="icon"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
        onClick={onDelete}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

function AssinaturasSection({
  ordemId, empresaId, tecnicoNome, assinaturas, onChange, checklistCompleto,
}: {
  ordemId: string; empresaId: string | null; tecnicoNome: string;
  assinaturas: any[]; onChange: () => void; checklistCompleto: boolean;
}) {
  const [open, setOpen] = useState<null | "tecnico_conclusao" | "cliente_entrega">(null);
  const [nomeCliente, setNomeCliente] = useState("");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const tem = (tipo: string) => assinaturas.some(a => a.tipo === tipo);

  const salvar = async () => {
    if (!dataUrl || !empresaId || !open) return;
    setSalvando(true);
    const nome = open === "tecnico_conclusao" ? tecnicoNome : nomeCliente.trim();
    if (!nome) {
      toast({ title: "Informe o nome do cliente", variant: "destructive" });
      setSalvando(false);
      return;
    }
    const { error } = await supabase.from("assinaturas_digitais").insert({
      ordem_id: ordemId,
      tipo: open,
      signatario_nome: nome,
      assinatura_base64: dataUrl,
      user_agent: navigator.userAgent,
      empresa_id: empresaId,
    });
    setSalvando(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Assinatura registrada" });
    setOpen(null); setDataUrl(null); setNomeCliente("");
    onChange();
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Conclusão pelo técnico</p>
            <p className="text-xs text-muted-foreground">
              {tem("tecnico_conclusao") ? "Assinada ✓" : "Pendente"}
            </p>
          </div>
          <Button
            size="sm"
            disabled={tem("tecnico_conclusao") || !checklistCompleto}
            onClick={() => setOpen("tecnico_conclusao")}
          >
            <FileSignature className="h-4 w-4 mr-1" /> Assinar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Entrega ao cliente</p>
            <p className="text-xs text-muted-foreground">
              {tem("cliente_entrega") ? "Assinada ✓" : "Pendente"}
            </p>
          </div>
          <Button size="sm" variant="outline" disabled={tem("cliente_entrega")} onClick={() => setOpen("cliente_entrega")}>
            <FileSignature className="h-4 w-4 mr-1" /> Coletar
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={o => { if (!o) setOpen(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {open === "tecnico_conclusao" ? "Assinatura do técnico" : "Assinatura do cliente"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {open === "cliente_entrega" && (
              <div className="space-y-1">
                <Label>Nome do cliente</Label>
                <Input value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} placeholder="Quem está retirando" />
              </div>
            )}
            <AssinaturaCanvas onChange={setDataUrl} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={!dataUrl || salvando}>
              <Upload className="h-4 w-4 mr-1" /> {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
