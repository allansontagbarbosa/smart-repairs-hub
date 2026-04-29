import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, FileDown, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useClientesSaldos } from "@/hooks/useClientesSaldos";
import { useExtratoPDF } from "@/hooks/useExtratoPDF";
import { ExtratoPDFViewer } from "@/components/financeiro/ExtratoPDFViewer";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const today = new Date();
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const toISODate = (date: Date) => format(date, "yyyy-MM-dd");
const parseISODate = (value: string | null) => value ? new Date(`${value}T00:00:00`) : undefined;

export default function FaturasLojistas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCliente = searchParams.get("cliente") || "";
  const initialInicio = searchParams.get("inicio") || toISODate(firstDayOfMonth);
  const initialFim = searchParams.get("fim") || toISODate(today);

  const [clienteId, setClienteId] = useState(initialCliente);
  const [inicio, setInicio] = useState(initialInicio);
  const [fim, setFim] = useState(initialFim);
  const [previewClienteId, setPreviewClienteId] = useState(initialCliente);
  const [previewInicio, setPreviewInicio] = useState(initialInicio);
  const [previewFim, setPreviewFim] = useState(initialFim);

  const { data: clientes = [], isLoading: loadingClientes } = useClientesSaldos();
  const { payload, isLoading: loadingExtrato, error } = useExtratoPDF(previewClienteId, previewInicio, previewFim);

  const { data: faturasAntigas = 0 } = useQuery({
    queryKey: ["lojista-faturas-count"],
    queryFn: async () => {
      const { count, error: countError } = await supabase
        .from("lojista_faturas" as never)
        .select("id", { count: "exact", head: true });
      if (countError) throw countError;
      return count ?? 0;
    },
  });

  const selectedCliente = useMemo(() => clientes.find((cliente) => cliente.id === clienteId), [clienteId, clientes]);

  useEffect(() => {
    if (!clienteId && clientes.length === 1) setClienteId(clientes[0].id);
  }, [clienteId, clientes]);

  const gerarPreview = () => {
    if (!clienteId || !inicio || !fim) return;
    setPreviewClienteId(clienteId);
    setPreviewInicio(inicio);
    setPreviewFim(fim);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("cliente", clienteId);
      next.set("inicio", inicio);
      next.set("fim", fim);
      return next;
    });
  };

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Extratos B2B</h1>
          <p className="page-subtitle">Gere um PDF do extrato de OS e pagamentos de um cliente para envio.</p>
        </div>
      </div>

      {faturasAntigas > 0 ? (
        <div className="rounded-lg border border-warning/30 bg-warning-muted p-4 text-sm text-warning-foreground">
          Esse fluxo foi substituído pela conta-corrente. Faturas anteriores estão preservadas no histórico — entre em contato com suporte se precisar acessar.
        </div>
      ) : null}

      <section className="rounded-lg border bg-card p-4">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-end">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId} disabled={loadingClientes}>
              <SelectTrigger>
                <SelectValue placeholder={loadingClientes ? "Carregando clientes..." : "Selecione um cliente"} />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((cliente) => (
                  <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DatePicker label="Data início" value={inicio} onChange={setInicio} />
          <DatePicker label="Data fim" value={fim} onChange={setFim} />
          <Button onClick={gerarPreview} disabled={!clienteId || !inicio || !fim || loadingClientes} className="gap-2">
            <FileDown className="h-4 w-4" /> Gerar PDF
          </Button>
        </div>
        {selectedCliente ? (
          <p className="mt-3 text-xs text-muted-foreground">Cliente selecionado: {selectedCliente.nome}</p>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar o extrato: {(error as Error).message}
        </div>
      ) : null}

      {previewClienteId ? (
        loadingExtrato || !payload ? (
          <div className="flex justify-center rounded-lg border bg-card py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ExtratoPDFViewer payload={payload} />
        )
      ) : (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
          Selecione um cliente e período para gerar o preview do extrato.
        </div>
      )}
    </div>
  );
}

function DatePicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const date = parseISODate(value);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(nextDate) => nextDate && onChange(toISODate(nextDate))}
            initialFocus
            locale={ptBR}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
