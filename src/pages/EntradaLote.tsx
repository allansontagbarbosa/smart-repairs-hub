import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Copy, Download, FileUp, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["status_ordem"];

interface AparelhoRow {
  id: string;
  marca: string;
  modelo: string;
  cor: string;
  imei: string;
  defeito: string;
  valor: string;
}

const emptyRow = (): AparelhoRow => ({
  id: crypto.randomUUID(),
  marca: "",
  modelo: "",
  cor: "",
  imei: "",
  defeito: "",
  valor: "",
});

const STEPS = ["Cliente", "Aparelhos", "Confirmação"];

export default function EntradaLote() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);

  // Step 1
  const [selectedClientId, setSelectedClientId] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [referenciaLote, setReferenciaLote] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [newClientNome, setNewClientNome] = useState("");
  const [newClientTelefone, setNewClientTelefone] = useState("");

  // Step 2
  const [rows, setRows] = useState<AparelhoRow[]>([emptyRow()]);

  // Step 3
  const [observacoesGerais, setObservacoesGerais] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["funcionarios-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("funcionarios").select("id, nome").eq("ativo", true).is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: marcasDB = [] } = useQuery({
    queryKey: ["marcas-autocomplete"],
    queryFn: async () => {
      const { data, error } = await supabase.from("marcas").select("nome").eq("ativo", true).order("nome");
      if (error) throw error;
      return data.map((m) => m.nome);
    },
  });

  const { data: modelosDB = [] } = useQuery({
    queryKey: ["modelos-autocomplete"],
    queryFn: async () => {
      const { data, error } = await supabase.from("modelos").select("nome").eq("ativo", true).order("nome");
      if (error) throw error;
      return data.map((m) => m.nome);
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .insert({ nome: newClientNome, telefone: newClientTelefone })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      setSelectedClientId(data.id);
      setShowNewClient(false);
      setNewClientNome("");
      setNewClientTelefone("");
      toast.success("Cliente cadastrado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectedClient = clientes.find((c) => c.id === selectedClientId);

  const updateRow = (id: string, field: keyof AparelhoRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const duplicateRow = (id: string) => {
    setRows((prev) => {
      const src = prev.find((r) => r.id === id);
      if (!src) return prev;
      const idx = prev.indexOf(src);
      const dup = { ...src, id: crypto.randomUUID(), imei: "" };
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const validRows = rows.filter((r) => r.marca && r.modelo && r.defeito);

  // CSV
  const downloadCSVTemplate = () => {
    const content = "marca,modelo,cor,imei,defeito,valor\nApple,iPhone 14,Preto,123456789012345,Tela quebrada,250\n";
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_lote.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) return toast.error("CSV vazio ou sem dados");
      const newRows: AparelhoRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        if (cols.length < 5) continue;
        newRows.push({
          id: crypto.randomUUID(),
          marca: cols[0] || "",
          modelo: cols[1] || "",
          cor: cols[2] || "",
          imei: cols[3] || "",
          defeito: cols[4] || "",
          valor: cols[5] || "",
        });
      }
      if (newRows.length === 0) return toast.error("Nenhuma linha válida no CSV");
      setRows((prev) => {
        const empty = prev.length === 1 && !prev[0].marca && !prev[0].modelo;
        return empty ? newRows : [...prev, ...newRows];
      });
      toast.success(`${newRows.length} aparelhos importados`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Submit
  const handleSubmit = async () => {
    if (validRows.length === 0) return;
    setCreating(true);
    try {
      const results = await Promise.all(
        validRows.map(async (row) => {
          const { data: aparelho, error: apErr } = await supabase
            .from("aparelhos")
            .insert({
              cliente_id: selectedClientId,
              marca: row.marca,
              modelo: row.modelo,
              cor: row.cor || null,
              imei: row.imei || null,
            })
            .select()
            .single();
          if (apErr) throw apErr;

          const { error: osErr } = await supabase.from("ordens_de_servico").insert({
            aparelho_id: aparelho.id,
            defeito_relatado: row.defeito,
            valor: row.valor ? parseFloat(row.valor) : null,
            data_entrada: new Date().toISOString(),
            status: "recebido" as Status,
            funcionario_id: tecnicoId || null,
            observacoes: observacoesGerais || null,
            referencia_lote: referenciaLote || null,
          });
          if (osErr) throw osErr;
        })
      );
      toast.success(`${validRows.length} ordens criadas com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["ordens"] });
      navigate(`/assistencia?search=${encodeURIComponent(selectedClient?.nome || "")}`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar ordens");
    } finally {
      setCreating(false);
    }
  };

  const canAdvance = () => {
    if (step === 0) return !!selectedClientId;
    if (step === 1) return validRows.length > 0;
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/assistencia")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Entrada em Lote</h1>
          <p className="text-sm text-muted-foreground">Cadastre múltiplos aparelhos de uma só vez</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center rounded-full h-8 w-8 text-sm font-semibold transition-colors ${
                i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground ring-2 ring-primary/30" : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-sm font-medium hidden sm:inline ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            {i < STEPS.length - 1 && <Separator className="w-8 sm:w-16" />}
          </div>
        ))}
      </div>

      {/* Step 1: Cliente */}
      {step === 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              {!showNewClient ? (
                <div className="flex gap-2">
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} — {c.telefone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => setShowNewClient(true)}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                  <Input placeholder="Nome" value={newClientNome} onChange={(e) => setNewClientNome(e.target.value)} />
                  <Input placeholder="Telefone" value={newClientTelefone} onChange={(e) => setNewClientTelefone(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!newClientNome || !newClientTelefone} onClick={() => createClientMutation.mutate()}>
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewClient(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Referência do lote</Label>
              <Input
                placeholder="Ex: Lote empresa XYZ - abril/2026"
                value={referenciaLote}
                onChange={(e) => setReferenciaLote(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Técnico responsável</Label>
              <Select value={tecnicoId} onValueChange={setTecnicoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {funcionarios.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Aparelhos */}
      {step === 1 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-semibold">{rows.length} aparelho{rows.length !== 1 ? "s" : ""} • {validRows.length} válido{validRows.length !== 1 ? "s" : ""}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={downloadCSVTemplate}>
                  <Download className="h-3.5 w-3.5 mr-1" />Baixar modelo CSV
                </Button>
                <label>
                  <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
                  <Button variant="outline" size="sm" asChild>
                    <span><FileUp className="h-3.5 w-3.5 mr-1" />Importar CSV</span>
                  </Button>
                </label>
                <Button size="sm" onClick={addRow}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-2">#</th>
                    <th className="pb-2 pr-2">Marca *</th>
                    <th className="pb-2 pr-2">Modelo *</th>
                    <th className="pb-2 pr-2">Cor</th>
                    <th className="pb-2 pr-2">IMEI</th>
                    <th className="pb-2 pr-2">Defeito *</th>
                    <th className="pb-2 pr-2">Valor (R$)</th>
                    <th className="pb-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 pr-2">
                        <Input
                          list="marcas-list"
                          placeholder="Marca"
                          className="h-8 min-w-[100px]"
                          value={row.marca}
                          onChange={(e) => updateRow(row.id, "marca", e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          list="modelos-list"
                          placeholder="Modelo"
                          className="h-8 min-w-[120px]"
                          value={row.modelo}
                          onChange={(e) => updateRow(row.id, "modelo", e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input className="h-8 min-w-[80px]" placeholder="Cor" value={row.cor} onChange={(e) => updateRow(row.id, "cor", e.target.value)} />
                      </td>
                      <td className="py-2 pr-2">
                        <Input className="h-8 min-w-[140px]" placeholder="IMEI" value={row.imei} onChange={(e) => updateRow(row.id, "imei", e.target.value)} />
                      </td>
                      <td className="py-2 pr-2">
                        <Input className="h-8 min-w-[140px]" placeholder="Defeito" value={row.defeito} onChange={(e) => updateRow(row.id, "defeito", e.target.value)} />
                      </td>
                      <td className="py-2 pr-2">
                        <Input className="h-8 min-w-[80px]" type="number" placeholder="0" value={row.valor} onChange={(e) => updateRow(row.id, "valor", e.target.value)} />
                      </td>
                      <td className="py-2 flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateRow(row.id)} title="Duplicar">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRow(row.id)} title="Remover" disabled={rows.length <= 1}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Datalists for autocomplete */}
            <datalist id="marcas-list">
              {marcasDB.map((m) => <option key={m} value={m} />)}
            </datalist>
            <datalist id="modelos-list">
              {modelosDB.map((m) => <option key={m} value={m} />)}
            </datalist>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirmação */}
      {step === 2 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="font-medium">{selectedClient?.nome || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Referência do lote</p>
                <p className="font-medium">{referenciaLote || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total de aparelhos</p>
                <p className="font-medium text-lg">{validRows.length}</p>
              </div>
            </div>

            <Separator />

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-2">#</th>
                    <th className="pb-2 pr-2">Marca</th>
                    <th className="pb-2 pr-2">Modelo</th>
                    <th className="pb-2 pr-2">IMEI</th>
                    <th className="pb-2 pr-2">Defeito</th>
                    <th className="pb-2 pr-2">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {validRows.map((row, idx) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-2 text-muted-foreground">{idx + 1}</td>
                      <td className="py-1.5 pr-2">{row.marca}</td>
                      <td className="py-1.5 pr-2">{row.modelo}</td>
                      <td className="py-1.5 pr-2 font-mono text-xs">{row.imei || "—"}</td>
                      <td className="py-1.5 pr-2">{row.defeito}</td>
                      <td className="py-1.5 pr-2">{row.valor ? `R$ ${row.valor}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <Label>Observações gerais do lote</Label>
              <Textarea
                placeholder="Observações que serão incluídas em todas as ordens..."
                value={observacoesGerais}
                onChange={(e) => setObservacoesGerais(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => (step === 0 ? navigate("/assistencia") : setStep(step - 1))}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {step === 0 ? "Voltar" : "Anterior"}
        </Button>

        {step < 2 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canAdvance()}>
            Próximo <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={creating || validRows.length === 0}>
            {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Criar {validRows.length} Orden{validRows.length !== 1 ? "s" : ""} de Serviço
          </Button>
        )}
      </div>
    </div>
  );
}
