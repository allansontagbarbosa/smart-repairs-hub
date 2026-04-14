import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { OrdemDetalheSheet } from "@/components/OrdemDetalheSheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Smartphone, ChevronDown, ChevronRight, Clock, MessageCircle, Eye, CalendarDays, Wrench, Loader2 } from "lucide-react";
import { abrirWhatsApp } from "@/lib/whatsapp";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["status_ordem"];

interface ClienteInfo {
  id: string;
  nome: string;
  whatsapp: string | null;
  telefone: string;
  total_os: number;
  total_gasto: number;
  ultimo_atendimento: string | null;
}

interface AparelhoComOS {
  id: string;
  marca: string;
  modelo: string;
  cor: string | null;
  capacidade: string | null;
  imei: string | null;
  ordens: OSResumida[];
}

interface OSResumida {
  id: string;
  numero: number;
  data_entrada: string;
  defeito_relatado: string;
  status: Status;
  valor: number | null;
  aparelho_marca: string;
  aparelho_modelo: string;
}

export function ClienteHistorico({ cliente }: { cliente: ClienteInfo }) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: aparelhos = [], isLoading: loadingAparelhos } = useQuery({
    queryKey: ["cliente-aparelhos", cliente.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aparelhos")
        .select("id, marca, modelo, cor, capacidade, imei")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ordens = [], isLoading: loadingOrdens } = useQuery({
    queryKey: ["cliente-ordens", cliente.id],
    queryFn: async () => {
      // Get all aparelho IDs for this client
      const { data: aps } = await supabase
        .from("aparelhos")
        .select("id, marca, modelo")
        .eq("cliente_id", cliente.id);
      if (!aps?.length) return [];

      const apIds = aps.map((a) => a.id);
      const apMap = Object.fromEntries(aps.map((a) => [a.id, a]));

      const { data, error } = await supabase
        .from("ordens_de_servico")
        .select("id, numero, data_entrada, defeito_relatado, status, valor, aparelho_id")
        .in("aparelho_id", apIds)
        .is("deleted_at", null)
        .order("data_entrada", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((o) => ({
        id: o.id,
        numero: o.numero,
        data_entrada: o.data_entrada,
        defeito_relatado: o.defeito_relatado,
        status: o.status,
        valor: o.valor,
        aparelho_marca: apMap[o.aparelho_id]?.marca ?? "",
        aparelho_modelo: apMap[o.aparelho_id]?.modelo ?? "",
      })) as OSResumida[];
    },
  });

  const aparelhosComOS: AparelhoComOS[] = aparelhos.map((ap) => ({
    ...ap,
    ordens: ordens.filter((o) => {
      // match by marca+modelo since we have aparelho_id in ordens
      return o.aparelho_marca === ap.marca && o.aparelho_modelo === ap.modelo;
    }),
  }));

  // Actually let's match by aparelho_id properly
  const { data: ordensComApId = [] } = useQuery({
    queryKey: ["cliente-ordens-full", cliente.id],
    queryFn: async () => {
      const apIds = aparelhos.map((a) => a.id);
      if (!apIds.length) return [];
      const { data, error } = await supabase
        .from("ordens_de_servico")
        .select("id, numero, data_entrada, defeito_relatado, status, valor, aparelho_id")
        .in("aparelho_id", apIds)
        .is("deleted_at", null)
        .order("data_entrada", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: aparelhos.length > 0,
  });

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");
  const fmtCurrency = (v: number | null) =>
    v ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` : "—";
  const truncImei = (imei: string | null) =>
    imei ? `${imei.slice(0, 8)}...` : "—";

  const totalAparelhos = aparelhos.length;
  const whatsappNum = cliente.whatsapp || cliente.telefone;

  const isLoading = loadingAparelhos || loadingOrdens;

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2">
        <SummaryCard label="Total OS" value={String(cliente.total_os)} />
        <SummaryCard label="Aparelhos" value={String(totalAparelhos)} />
        <SummaryCard label="Último" value={cliente.ultimo_atendimento ? fmtDate(cliente.ultimo_atendimento) : "—"} />
        <SummaryCard label="Total" value={fmtCurrency(cliente.total_gasto)} />
      </div>

      {/* WhatsApp button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full mt-3 text-green-600 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950"
        onClick={() => abrirWhatsApp(whatsappNum, `Olá ${cliente.nome}, tudo bem?`)}
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        Enviar WhatsApp
      </Button>

      <Separator className="my-4" />

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Aparelhos section */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Aparelhos ({totalAparelhos})
            </p>
            {aparelhos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum aparelho cadastrado.</p>
            ) : (
              <div className="space-y-1.5">
                {aparelhos.map((ap) => {
                  const apOrdens = ordensComApId.filter((o) => o.aparelho_id === ap.id);
                  return (
                    <AparelhoItem
                      key={ap.id}
                      aparelho={ap}
                      ordens={apOrdens}
                      fmtDate={fmtDate}
                      fmtCurrency={fmtCurrency}
                      truncImei={truncImei}
                      onViewOS={setSelectedOrderId}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <Separator className="my-4" />

          {/* Timeline section */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Timeline de OS
            </p>
            {ordensComApId.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ordem de serviço.</p>
            ) : (
              <div className="relative pl-4">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                {ordensComApId.map((os) => {
                  const ap = aparelhos.find((a) => a.id === os.aparelho_id);
                  return (
                    <div
                      key={os.id}
                      className="relative flex items-start gap-3 pb-4 last:pb-0 cursor-pointer group"
                      onClick={() => setSelectedOrderId(os.id)}
                    >
                      <div className="absolute left-[-13px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background z-10" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">{fmtDate(os.data_entrada)}</span>
                          <span className="text-xs font-medium">#{String(os.numero).padStart(3, "0")}</span>
                          <StatusBadge status={os.status} />
                        </div>
                        <p className="text-sm mt-0.5 truncate">
                          {ap ? `${ap.marca} ${ap.modelo}` : "Aparelho"} — {os.defeito_relatado}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {os.valor ? (
                            <span className="text-xs font-medium text-foreground">{fmtCurrency(os.valor)}</span>
                          ) : null}
                          <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Eye className="h-3 w-3" /> Ver OS
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* OS detail sheet */}
      <OrdemDetalheSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2 text-center">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold mt-0.5 truncate">{value}</p>
    </div>
  );
}

function AparelhoItem({
  aparelho,
  ordens,
  fmtDate,
  fmtCurrency,
  truncImei,
  onViewOS,
}: {
  aparelho: { id: string; marca: string; modelo: string; cor: string | null; capacidade: string | null; imei: string | null };
  ordens: { id: string; numero: number; data_entrada: string; defeito_relatado: string; status: Status; valor: number | null }[];
  fmtDate: (d: string) => string;
  fmtCurrency: (v: number | null) => string;
  truncImei: (imei: string | null) => string;
  onViewOS: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors text-left">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{aparelho.marca} {aparelho.modelo}</span>
          <span className="text-xs text-muted-foreground ml-2">
            {[aparelho.cor, aparelho.capacidade].filter(Boolean).join(" • ") || ""}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">{truncImei(aparelho.imei)}</span>
        <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full">{ordens.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-8 pr-2 pb-1">
        {ordens.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">Nenhuma OS para este aparelho.</p>
        ) : (
          <div className="space-y-1">
            {ordens.map((os) => (
              <div
                key={os.id}
                className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onViewOS(os.id)}
              >
                <span className="text-xs font-medium w-10">#{String(os.numero).padStart(3, "0")}</span>
                <span className="text-xs text-muted-foreground w-16">{fmtDate(os.data_entrada)}</span>
                <span className="text-xs truncate flex-1">{os.defeito_relatado}</span>
                <StatusBadge status={os.status} />
                <span className="text-xs font-medium w-14 text-right">{fmtCurrency(os.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
