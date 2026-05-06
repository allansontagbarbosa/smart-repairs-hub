import { useState, useMemo } from "react";
import { Search, Receipt, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { NovoRecebimentoDialog } from "./NovoRecebimentoDialog";

const fmtCurrency = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const parseDate = (d: string) => new Date(d.includes("T") ? d : `${d}T12:00:00`);
const fmtDate = (d: string) => format(parseDate(d), "dd/MM/yyyy");

const FORMAS_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro" },
];

const BADGE_COLORS: Record<string, string> = {
  pix: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  cartao_debito: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  cartao_credito: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  dinheiro: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  transferencia: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  boleto: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  outro: "bg-muted text-muted-foreground",
};

export type Recebimento = {
  id: string;
  descricao: string;
  valor: number;
  data_recebimento: string;
  // Forma de pagamento real: pix, dinheiro, cartao_debito, etc. Pode ser null em registros antigos.
  forma_pagamento: string | null;
  // Origem da entrada: "os" se vinculada a uma OS, "avulso" caso contrário.
  origem: "os" | "avulso";
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

export function Recebimentos({ recebimentos }: Props) {
  const [search, setSearch] = useState("");
  const [filterForma, setFilterForma] = useState("todas");
  const [filterOrigem, setFilterOrigem] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(false);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const totaisMes = useMemo(() => {
    const noMes = recebimentos.filter(r => {
      const d = parseDate(r.data_recebimento);
      return d >= monthStart && d <= monthEnd;
    });
    const avulsos = noMes
      .filter(r => r.origem === "avulso")
      .reduce((s, r) => s + Number(r.valor), 0);
    const deOS = noMes
      .filter(r => r.origem === "os")
      .reduce((s, r) => s + Number(r.valor), 0);
    return { avulsos, deOS, total: avulsos + deOS };
  }, [recebimentos, monthStart, monthEnd]);

  const filtered = useMemo(() => {
    let list = recebimentos;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r => r.descricao.toLowerCase().includes(q));
    }
    if (filterOrigem !== "todas") {
      list = list.filter(r => r.origem === filterOrigem);
    }
    if (filterForma !== "todas") {
      list = list.filter(r => r.forma_pagamento === filterForma);
    }
    return list;
  }, [recebimentos, search, filterForma, filterOrigem]);

  const formaLabel = (v: string | null) => {
    if (!v) return "—";
    return FORMAS_PAGAMENTO.find(f => f.value === v)?.label ?? v;
  };

  return (
    <div className="space-y-4">
      {/* Totais do mês */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card border-success/20 bg-success-muted">
          <Receipt className="h-4 w-4 text-success mb-2" />
          <p className="stat-value text-success">{fmtCurrency(totaisMes.avulsos)}</p>
          <p className="stat-label">Recebimentos avulsos no mês</p>
        </div>
        <div className="stat-card">
          <Receipt className="h-4 w-4 text-muted-foreground mb-2" />
          <p className="stat-value">{fmtCurrency(totaisMes.deOS)}</p>
          <p className="stat-label">Recebimentos de OS no mês</p>
        </div>
        <div className="stat-card">
          <Receipt className="h-4 w-4 text-muted-foreground mb-2" />
          <p className="stat-value">{fmtCurrency(totaisMes.total)}</p>
          <p className="stat-label">Total geral no mês</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar recebimento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterOrigem} onValueChange={setFilterOrigem}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas origens</SelectItem>
            <SelectItem value="os">De OS</SelectItem>
            <SelectItem value="avulso">Avulsa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterForma} onValueChange={setFilterForma}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas formas</SelectItem>
            {FORMAS_PAGAMENTO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1.5" />
          Novo Recebimento
        </Button>
      </div>

      {/* Lista */}
      <div className="section-card divide-y">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {recebimentos.length === 0
              ? "Nenhum recebimento registrado ainda. Clique em \"Novo Recebimento\" pra criar o primeiro."
              : "Nenhum recebimento encontrado com os filtros atuais."}
          </p>
        ) : (
          filtered.map(r => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{r.descricao}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(r.data_recebimento)}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.origem === "os" ? "bg-success-muted text-success" : "bg-muted text-muted-foreground"}`}>
                  {r.origem === "os" ? "De OS" : "Avulsa"}
                </span>
                {r.forma_pagamento && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${BADGE_COLORS[r.forma_pagamento] ?? "bg-muted text-muted-foreground"}`}>
                    {formaLabel(r.forma_pagamento)}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-success whitespace-nowrap">{fmtCurrency(Number(r.valor))}</p>
            </div>
          ))
        )}
      </div>

      <NovoRecebimentoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
