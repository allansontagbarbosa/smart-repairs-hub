import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";
import { Settings, FileText, Calendar, Shield, Bell, Loader2, Save, AlertCircle, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ListasManager } from "@/components/atacado/ListasManager";

type Config = Record<string, any>;

export default function AtacadoConfiguracoes() {
  const { empresaId } = useEmpresa();
  const qc = useQueryClient();
  const [form, setForm] = useState<Config>({});

  const { data: config, isLoading } = useQuery({
    queryKey: ["atacado-config", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atacado_configuracoes" as any)
        .select("*")
        .eq("empresa_id", empresaId!)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? { empresa_id: empresaId };
    },
    enabled: !!empresaId,
  });

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = { ...form, empresa_id: empresaId, updated_at: new Date().toISOString() };
      const { error } = await supabase
        .from("atacado_configuracoes" as any)
        .upsert(payload, { onConflict: "empresa_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["atacado-config"] });
      toast.success("Configurações salvas");
    },
    onError: (e: any) => toast.error("Erro ao salvar", { description: e.message }),
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-6 w-6" /> Configurações Atacado
          </h1>
          <p className="text-sm text-muted-foreground">
            NF-e, prazos, política de crédito e notificações
          </p>
        </div>
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          {salvar.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar tudo
        </Button>
      </div>

      <Tabs defaultValue="nfe" className="space-y-4">
        <TabsList>
          <TabsTrigger value="nfe">
            <FileText className="h-4 w-4 mr-2" /> NF-e
          </TabsTrigger>
          <TabsTrigger value="prazos">
            <Calendar className="h-4 w-4 mr-2" /> Prazos
          </TabsTrigger>
          <TabsTrigger value="credito">
            <Shield className="h-4 w-4 mr-2" /> Crédito
          </TabsTrigger>
          <TabsTrigger value="notif">
            <Bell className="h-4 w-4 mr-2" /> Notificações
          </TabsTrigger>
          <TabsTrigger value="listas">
            <List className="h-4 w-4 mr-2" /> Cadastros
          </TabsTrigger>
        </TabsList>

        {/* NF-e */}
        <TabsContent value="nfe">
          <Card className="p-6 space-y-6">
            <h2 className="text-lg font-semibold">Configuração NF-e</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Ambiente">
                <Select
                  value={form.nfe_ambiente ?? "homologacao"}
                  onValueChange={(v) => set("nfe_ambiente", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Série NF-e">
                <Input
                  value={form.nfe_serie ?? ""}
                  onChange={(e) => set("nfe_serie", e.target.value)}
                />
              </Field>

              <Field label="Próximo número">
                <Input
                  type="number"
                  value={form.nfe_proximo_numero ?? 1}
                  onChange={(e) => set("nfe_proximo_numero", parseInt(e.target.value) || 1)}
                />
              </Field>

              <Field label="CFOP padrão (venda)">
                <Input
                  value={form.nfe_cfop_padrao ?? ""}
                  onChange={(e) => set("nfe_cfop_padrao", e.target.value)}
                  placeholder="5102"
                />
              </Field>

              <Field label="Natureza da operação">
                <Input
                  value={form.nfe_natureza_operacao ?? ""}
                  onChange={(e) => set("nfe_natureza_operacao", e.target.value)}
                />
              </Field>

              <Field label="CNAE principal">
                <Input
                  value={form.nfe_cnae ?? ""}
                  onChange={(e) => set("nfe_cnae", e.target.value)}
                  placeholder="ex: 4751-2/01"
                />
              </Field>
            </div>

            <div className="border rounded-lg p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Certificado digital A1</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {form.nfe_certificado_uploaded
                    ? `✓ Cadastrado · vence em ${
                        form.nfe_certificado_validade
                          ? new Date(form.nfe_certificado_validade).toLocaleDateString("pt-BR")
                          : "—"
                      }`
                    : "Nenhum certificado enviado"}
                </p>
              </div>
              <Button variant="outline" disabled>
                {form.nfe_certificado_uploaded ? "Substituir" : "Enviar certificado"}
              </Button>
            </div>

            {form.nfe_ambiente === "homologacao" && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/15 text-warning border border-warning/30 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  Ambiente de homologação. NF-e emitida não tem valor fiscal. Mude para produção
                  quando estiver pronto.
                </p>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Prazos */}
        <TabsContent value="prazos">
          <Card className="p-6 space-y-6">
            <h2 className="text-lg font-semibold">Prazos e juros</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Prazo padrão de pagamento (dias)">
                <Input
                  type="number"
                  value={form.prazo_pagamento_padrao_dias ?? 30}
                  onChange={(e) => set("prazo_pagamento_padrao_dias", parseInt(e.target.value) || 0)}
                />
              </Field>

              <Field label="Condição padrão">
                <Select
                  value={form.condicao_pagamento_padrao ?? "30 dias"}
                  onValueChange={(v) => set("condicao_pagamento_padrao", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="À vista">À vista</SelectItem>
                    <SelectItem value="30 dias">30 dias</SelectItem>
                    <SelectItem value="30/60">30/60</SelectItem>
                    <SelectItem value="30/60/90">30/60/90</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Juros por dia de atraso (%)">
                <Input
                  value={form.juros_atraso_pct ?? 1}
                  onChange={(e) =>
                    set("juros_atraso_pct", parseFloat(e.target.value.replace(",", ".")) || 0)
                  }
                />
              </Field>

              <Field
                label="Multa por atraso (%)"
                hint="Cobrança única quando passa do vencimento"
              >
                <Input
                  value={form.multa_atraso_pct ?? 2}
                  onChange={(e) =>
                    set("multa_atraso_pct", parseFloat(e.target.value.replace(",", ".")) || 0)
                  }
                />
              </Field>
            </div>
          </Card>
        </TabsContent>

        {/* Crédito */}
        <TabsContent value="credito">
          <Card className="p-6 space-y-6">
            <h2 className="text-lg font-semibold">Política de crédito</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Limite inicial para novo cliente (R$)"
                hint="Atribuído automaticamente ao cadastrar. Ajustável depois."
              >
                <Input
                  value={form.limite_credito_inicial_novo_cliente ?? 0}
                  onChange={(e) =>
                    set(
                      "limite_credito_inicial_novo_cliente",
                      parseFloat(e.target.value.replace(",", ".")) || 0
                    )
                  }
                />
              </Field>

              <Field
                label="Pedidos acima de (R$) precisam aprovação"
                hint="Pedidos acima desse valor vão para aprovação mesmo dentro do limite"
              >
                <Input
                  value={form.exigir_aprovacao_pedidos_acima ?? 10000}
                  onChange={(e) =>
                    set(
                      "exigir_aprovacao_pedidos_acima",
                      parseFloat(e.target.value.replace(",", ".")) || 0
                    )
                  }
                />
              </Field>

              <Field
                label="Bloquear cliente após X dias de atraso"
                hint="0 = desabilitado. Cliente com título atrasado mais que isso fica status=bloqueado."
              >
                <Input
                  type="number"
                  value={form.bloquear_automatico_se_atrasos_dias ?? 60}
                  onChange={(e) =>
                    set("bloquear_automatico_se_atrasos_dias", parseInt(e.target.value) || 0)
                  }
                />
              </Field>
            </div>

            <div className="flex items-center justify-between gap-4 border rounded-lg p-4">
              <div>
                <p className="font-medium">Permitir venda para cliente inadimplente</p>
                <p className="text-xs text-muted-foreground">
                  Se ativo, vendedor pode criar pedido mesmo com atrasos (vai para aprovação)
                </p>
              </div>
              <Switch
                checked={!!form.permitir_venda_cliente_inadimplente}
                onCheckedChange={(v) => set("permitir_venda_cliente_inadimplente", v)}
              />
            </div>
          </Card>
        </TabsContent>

        {/* Notificações */}
        <TabsContent value="notif">
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Notificações automáticas</h2>

            <div className="flex items-center justify-between gap-4 border rounded-lg p-4">
              <div>
                <p className="font-medium">E-mail para boletos vencidos</p>
                <p className="text-xs text-muted-foreground">
                  Envia automaticamente após 1 dia de atraso
                </p>
              </div>
              <Switch
                checked={!!form.notificar_email_boletos_vencidos}
                onCheckedChange={(v) => set("notificar_email_boletos_vencidos", v)}
              />
            </div>

            <div className="flex items-center justify-between gap-4 border rounded-lg p-4">
              <div>
                <p className="font-medium">WhatsApp para boletos vencidos</p>
                <p className="text-xs text-muted-foreground">
                  Requer integração WhatsApp Business API
                </p>
              </div>
              <Switch
                checked={!!form.notificar_wpp_boletos_vencidos}
                onCheckedChange={(v) => set("notificar_wpp_boletos_vencidos", v)}
              />
            </div>

            <Field label="Lembrete de vencimento (X dias antes)">
              <Input
                type="number"
                value={form.lembrete_vencimento_dias ?? 3}
                onChange={(e) => set("lembrete_vencimento_dias", parseInt(e.target.value) || 0)}
              />
            </Field>
          </Card>
        </TabsContent>

        {/* Cadastros / Listas */}
        <TabsContent value="listas">
          <Card className="p-6">
            <ListasManager />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
