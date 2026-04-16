import { useState, useMemo } from "react";
import { Plus, Search, Receipt } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => format(new Date(d + "T12:00:00"), "dd/MM/yyyy");

const FORMAS_PAGAMENTO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "transferencia", label: "Transferência" },
];

const BADGE_COLORS: Record<string, string> = {
  pix: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  cartao_debito: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  cartao_credito: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  dinheiro: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  transferencia: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

export type Recebimento = {
  id: string;
  descricao: string;
  valor: number;
  data_recebimento: string;
  forma_pagamento: string;
  ordem_servico_id: string | null;
  cliente_id: string | null;
  loja_id: string | null;
  observacoes: string | null;
  created_at: string;
};

interface Props {
  recebimentos: Recebimento[];
  ordens: { id: string; numero: number }[];
}

export function Recebimentos({ recebimentos, ordens }: Props) {
  const [search, setSearch] = useState("");
  const [filterForma, setFilterForma] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const totalMes = useMemo(() =>
    recebimentos
      .filter(r => {
        const d = new Date(r.data_recebimento + "T12:00:00");
        return d >= monthStart && d <= monthEnd;
      })
      .reduce((s, r) => s + Number(r.valor), 0),
    [recebimentos, monthStart, monthEnd]
  );

  const filtered = useMemo(() => {
    let list = recebimentos;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => r.descricao.toLowerCase().includes(q));
    }
    if (filterForma !== "todas") {
      list = list.filter(r => r.forma_pagamento === filterForma);
    }
    return list;
  }, [recebimentos, search, filterForma]);

  // Dialog state
  const [form, setForm] = useState({
    descricao: "",
    valor: "",
    data_recebimento: format(now, "yyyy-MM-dd"),
    forma_pagamento: "dinheiro",
    ordem_servico_id: "",
    observacoes: "",
  });

  const resetForm = () => setForm({
    descricao: "",
    valor: "",
    data_recebimento: format(now, "yyyy-MM-dd"),
    forma_pagamento: "dinheiro",
    ordem_servico_id: "",
    observacoes: "",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("recebimentos").insert({
        descricao: form.descricao,
        valor: parseFloat(form.valor),
        data_recebimento: form.data_recebimento,
        forma_pagamento: form.forma_pagamento,
        ordem_servico_id: form.ordem_servico_id || null,
        observacoes: form.observacoes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recebimentos"] });
      toast.success("Recebimento registrado!");
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast.error("Erro ao registrar recebimento"),
  });

  const formaLabel = (v: string) => FORMAS_PAGAMENTO.find(f => f.value === v)?.label ?? v;

  return (
    <div className="space-y-4">
      {/* Total do mês */}
      <div className="stat-card border-success/20 bg-success-muted">
        <Receipt className="h-4 w-4 text-success mb-2" />
        <p className="stat-value text-success">{fmtCurrency(totalMes)}</p>
        <p className="stat-label">Total recebido no mês</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar recebimento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterForma} onValueChange={setFilterForma}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas formas</SelectItem>
            {FORMAS_PAGAMENTO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo recebimento
        </Button>
      </div>

      {/* Lista */}
      <div className="section-card divide-y">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum recebimento encontrado</p>
        ) : (
          filtered.map(r => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{r.descricao}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(r.data_recebimento)}</p>
              </div>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_COLORS[r.forma_pagamento] ?? "bg-muted text-muted-foreground"}`}>
                {formaLabel(r.forma_pagamento)}
              </span>
              <p className="text-sm font-semibold text-success whitespace-nowrap">{fmtCurrency(Number(r.valor))}</p>
            </div>
          ))
        )}
      </div>

      {/* Dialog novo recebimento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Recebimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor *</Label>
                <Input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
              <div>
                <Label>Data *</Label>
                <Input type="date" value={form.data_recebimento} onChange={e => setForm(f => ({ ...f, data_recebimento: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={v => setForm(f => ({ ...f, forma_pagamento: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>OS vinculada (opcional)</Label>
              <Select value={form.ordem_servico_id} onValueChange={v => setForm(f => ({ ...f, ordem_servico_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {ordens.map(o => <SelectItem key={o.id} value={o.id}>OS #{o.numero}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.descricao || !form.valor || !form.data_recebimento || createMutation.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
