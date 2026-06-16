import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, FileDown, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useClientesSaldos } from "@/hooks/useClientesSaldos";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { baixarFaturaPDF, type FaturaPayload, type FaturaItem } from "@/lib/pdf/gerarFaturaPDF";

const formatarMoeda = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatarData = (value: string | null | undefined) =>
  value ? new Date(value.includes("T") ? value : `${value}T00:00:00`).toLocaleDateString("pt-BR") : "—";

type FaturaResponse = {
  success: boolean;
  error?: string;
  cliente?: { id: string; nome: string };
  resumo?: { faturado: number; pago: number; devedor: number };
  itens?: FaturaItem[];
  quitados?: { quantidade: number; numeros: string[] };
};

export default function FaturasLojistas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCliente = searchParams.get("cliente") || "";
  const [clienteId, setClienteId] = useState(initialCliente);

  const { empresa } = useEmpresa();
  const { data: clientes = [], isLoading: loadingClientes } = useClientesSaldos();

  useEffect(() => {
    if (!clienteId && clientes.length === 1) setClienteId(clientes[0].id);
  }, [clienteId, clientes]);

  useEffect(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (clienteId) next.set("cliente", clienteId);
      else next.delete("cliente");
      next.delete("inicio");
      next.delete("fim");
      return next;
    }, { replace: true });
  }, [clienteId, setSearchParams]);

  const faturaQuery = useQuery({
    enabled: !!clienteId,
    queryKey: ["fatura-cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gerar_fatura_cliente", { p_cliente_id: clienteId });
      if (error) throw error;
      return data as unknown as FaturaResponse;
    },
  });

  const data = faturaQuery.data;
  const selectedCliente = useMemo(() => clientes.find((c) => c.id === clienteId), [clienteId, clientes]);

  const payload: FaturaPayload | null = useMemo(() => {
    if (!data?.success || !data.cliente || !data.resumo) return null;
    return {
      cliente: data.cliente,
      resumo: data.resumo,
      itens: data.itens ?? [],
      quitados: data.quitados ?? { quantidade: 0, numeros: [] },
      empresa: empresa ? {
        nome: empresa.nome,
        telefone: empresa.telefone,
        email: empresa.email,
        cnpj: empresa.cnpj,
        endereco: empresa.endereco,
      } : null,
    };
  }, [data, empresa]);

  const semSaldo = !!data?.success && (data.itens?.length ?? 0) === 0;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fatura em aberto</h1>
          <p className="page-subtitle">Lista só os aparelhos que o cliente ainda deve, abatendo o que já foi pago.</p>
        </div>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <ClienteSearchSelect
              value={clienteId}
              onChange={setClienteId}
              clientes={clientes.map((c) => ({ id: c.id, nome: c.nome }))}
              disabled={loadingClientes}
            />
          </div>
          <Button
            onClick={() => payload && baixarFaturaPDF(payload)}
            disabled={!payload || semSaldo}
            className="gap-2"
          >
            <FileDown className="h-4 w-4" /> Baixar PDF
          </Button>
        </div>
        {selectedCliente ? (
          <p className="mt-3 text-xs text-muted-foreground">Cliente selecionado: {selectedCliente.nome}</p>
        ) : null}
      </section>

      {faturaQuery.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar a fatura: {(faturaQuery.error as Error).message}
        </div>
      ) : null}

      {data && !data.success ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {data.error}
        </div>
      ) : null}

      {!clienteId ? (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
          Selecione um cliente para visualizar a fatura em aberto.
        </div>
      ) : faturaQuery.isLoading || !data ? (
        <div className="flex justify-center rounded-lg border bg-card py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : semSaldo ? (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
          Cliente sem saldo em aberto.
        </div>
      ) : payload ? (
        <section className="rounded-lg border bg-card p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <ResumoCard label="Faturado" value={payload.resumo.faturado} />
            <ResumoCard label="Já pago" value={payload.resumo.pago} />
            <ResumoCard label="Saldo devedor" value={payload.resumo.devedor} highlight />
          </div>

          <div>
            {payload.itens.map((item) => (
              <div key={item.os_id} className="flex items-center gap-3 py-3 border-b last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {[item.aparelho, item.servico].filter(Boolean).join(" — ") || "—"}
                    {item.parcial && <span className="text-amber-600 text-xs ml-1">(saldo parcial)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">OS #{item.numero} · {formatarData(item.data)}</div>
                </div>
                <div className="text-right">
                  {item.parcial && (
                    <div className="text-xs line-through text-muted-foreground">{formatarMoeda(item.valor_original)}</div>
                  )}
                  <div className="text-sm font-medium">{formatarMoeda(item.saldo_aberto)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm font-medium">Total da fatura</span>
            <span className="text-lg font-semibold">{formatarMoeda(payload.resumo.devedor)}</span>
          </div>

          {payload.quitados.quantidade > 0 ? (
            <p className="text-xs text-muted-foreground italic">
              {payload.quitados.quantidade} aparelho{payload.quitados.quantidade > 1 ? "s" : ""} já quitado{payload.quitados.quantidade > 1 ? "s" : ""} (OS {payload.quitados.numeros.join(", ")}) não constam nesta fatura.
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ResumoCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", highlight && "border-primary/40 bg-primary/5")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold", highlight && "text-primary")}>
        {Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </div>
    </div>
  );
}

function ClienteSearchSelect({ value, onChange, clientes, disabled }: { value: string; onChange: (value: string) => void; clientes: Array<{ id: string; nome: string }>; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = clientes.find((cliente) => cliente.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}
        >
          <span className="truncate">{selected?.nome || (disabled ? "Carregando clientes..." : "Buscar cliente...")}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cliente..." />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              {clientes.map((cliente) => (
                <CommandItem
                  key={cliente.id}
                  value={cliente.nome}
                  onSelect={() => {
                    onChange(cliente.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === cliente.id ? "opacity-100" : "opacity-0")} />
                  {cliente.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
