import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/smart-inputs/CurrencyInput";
import { formatBRL } from "@/lib/utils";
import { Loader2, MessageSquare, Send, CheckCircle2, XCircle, RefreshCw, Handshake } from "lucide-react";

const LS_KEY = (slug: string) => `catalogo-ofertas-${slug}`;

export type GrupoOferta = {
  modelo: string;
  capacidade: string | null;
  cor: string | null;
  grade: string | null;
  condicao: string | null;
  quantidade: number;
  preco_publico: number | null;
};

export function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pendente: { label: "Aguardando vendedor", cls: "bg-amber-100 text-amber-900" },
    contraoferta: { label: "Contraoferta recebida", cls: "bg-blue-100 text-blue-900" },
    aceita: { label: "Aceita", cls: "bg-emerald-100 text-emerald-900" },
    recusada: { label: "Recusada", cls: "bg-rose-100 text-rose-900" },
    expirada: { label: "Expirada", cls: "bg-muted text-muted-foreground" },
    finalizada: { label: "Finalizada", cls: "bg-emerald-200 text-emerald-900" },
  };
  const c = map[status] ?? { label: status, cls: "bg-muted" };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.cls}`}>{c.label}</span>;
}

export function saveTokenLocal(slug: string, token: string) {
  const cur = JSON.parse(localStorage.getItem(LS_KEY(slug)) ?? "[]") as string[];
  if (!cur.includes(token)) {
    cur.push(token);
    localStorage.setItem(LS_KEY(slug), JSON.stringify(cur));
  }
}

export function getTokensLocal(slug: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY(slug)) ?? "[]");
  } catch {
    return [];
  }
}

// ============ Dialog: criar oferta ============
export function FazerOfertaDialog({
  open, onOpenChange, slug, grupo, onCreated,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  slug: string;
  grupo: GrupoOferta | null;
  onCreated: (token: string) => void;
}) {
  const [qtd, setQtd] = useState(1);
  const [valor, setValor] = useState(0);
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");

  const reset = () => { setQtd(1); setValor(0); setNome(""); setContato(""); setMsg(""); setErro(""); };

  const criar = useMutation({
    mutationFn: async () => {
      if (!grupo) throw new Error("Sem produto");
      const { data, error } = await supabase.rpc("catalogo_criar_oferta" as any, {
        p_slug: slug,
        p_modelo: grupo.modelo,
        p_capacidade: grupo.capacidade,
        p_cor: grupo.cor,
        p_grade: grupo.grade,
        p_condicao: grupo.condicao,
        p_aparelho_id: null,
        p_quantidade: qtd,
        p_valor: valor,
        p_nome: nome,
        p_contato: contato,
        p_mensagem: msg || null,
      });
      if (error) throw error;
      return (data as any)?.[0];
    },
    onSuccess: (data) => {
      if (data?.token) {
        saveTokenLocal(slug, data.token);
        onCreated(data.token);
      }
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => setErro(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(b) => { if (!b) reset(); onOpenChange(b); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fazer oferta</DialogTitle>
        </DialogHeader>
        {grupo && (
          <div className="space-y-3">
            <div className="text-sm">
              <p className="font-semibold">{grupo.modelo} {grupo.capacidade ?? ""}</p>
              <p className="text-muted-foreground text-xs">
                {[grupo.cor, grupo.grade, grupo.condicao].filter(Boolean).join(" · ") || "—"}
                {" · "}{grupo.quantidade} disponíveis
                {grupo.preco_publico ? ` · Preço pedido: ${formatBRL(Number(grupo.preco_publico))}` : ""}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Quantidade</Label>
                <Input type="number" min={1} max={grupo.quantidade}
                  value={qtd}
                  onChange={(e) => setQtd(Math.max(1, Math.min(grupo.quantidade, parseInt(e.target.value) || 1)))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sua oferta (unitário)</Label>
                <CurrencyInput value={valor} onValueChange={setValor} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Seu nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contato (WhatsApp ou e-mail)</Label>
              <Input value={contato} onChange={(e) => setContato(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mensagem (opcional)</Label>
              <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500} rows={2} />
            </div>
            {valor > 0 && (
              <p className="text-xs text-muted-foreground">
                Total ofertado: <span className="font-semibold">{formatBRL(qtd * valor)}</span>
              </p>
            )}
            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => { setErro(""); criar.mutate(); }}
            disabled={criar.isPending || !grupo || valor <= 0 || !nome || !contato}
          >
            {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1"/>Enviar oferta</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Detalhe oferta + ações cliente ============
export function MinhaOfertaCard({
  slug, token, whatsapp, tituloCatalogo,
}: { slug: string; token: string; whatsapp: string | null; tituloCatalogo: string | null }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["oferta", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("catalogo_get_oferta" as any, { p_token: token });
      if (error) throw error;
      return data as any;
    },
  });

  const [valorContra, setValorContra] = useState(0);
  const [msgContra, setMsgContra] = useState("");
  const [showContra, setShowContra] = useState(false);

  const respond = useMutation({
    mutationFn: async (vars: { acao: "aceitar" | "recusar" | "contraofertar"; valor?: number; msg?: string }) => {
      const { error } = await supabase.rpc("catalogo_responder_oferta_cliente" as any, {
        p_token: token,
        p_acao: vars.acao,
        p_valor: vars.valor ?? null,
        p_msg: vars.msg ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setShowContra(false); setValorContra(0); setMsgContra("");
      qc.invalidateQueries({ queryKey: ["oferta", token] });
    },
  });

  const finalize = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("catalogo_finalizar_oferta" as any, { p_token: token });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["oferta", token] }),
  });

  if (q.isLoading) return <Card className="p-4"><Loader2 className="h-4 w-4 animate-spin" /></Card>;
  if (q.isError) {
    return (
      <Card className="p-4 text-sm space-y-1">
        <p className="text-destructive">Não foi possível carregar esta oferta.</p>
        <p className="text-xs text-muted-foreground break-all">Token: {token}</p>
      </Card>
    );
  }
  const o = q.data;
  const rounds: any[] = o?.rounds ?? [];
  const podeAgir = ["pendente","contraoferta"].includes(o.status);
  const podeFinalizar = o.status === "aceita";

  const abrirWhats = () => {
    if (!whatsapp) { alert("Vendedor sem WhatsApp configurado."); return; }
    const num = whatsapp.replace(/\D/g, "");
    const desc = [o.modelo, o.capacidade, o.cor, o.grade].filter(Boolean).join(" ");
    const total = Number(o.valor_oferta) * Number(o.quantidade);
    const msg =
      `Olá! Negócio fechado pelo catálogo ${tituloCatalogo ?? ""}.\n\n` +
      `• ${o.quantidade}x ${desc}\n` +
      `• Valor combinado: ${formatBRL(Number(o.valor_oferta))} cada (total ${formatBRL(total)})\n\n` +
      `Cliente: ${o.cliente_nome}\nContato: ${o.cliente_contato}`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
    finalize.mutate();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">
            {o.quantidade}x {o.modelo} {o.capacidade ?? ""}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {[o.cor, o.grade, o.condicao].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        {statusBadge(o.status)}
      </div>

      <div className="text-sm">
        <span className="text-muted-foreground">Valor atual:</span>{" "}
        <span className="font-semibold">{formatBRL(Number(o.valor_oferta))}</span>{" "}
        <span className="text-muted-foreground">(total {formatBRL(Number(o.valor_oferta) * o.quantidade)})</span>
      </div>

      <div className="border-t pt-2 space-y-1.5 max-h-44 overflow-auto">
        {rounds.map((r) => (
          <div key={r.id} className="text-xs flex items-start gap-2">
            <Badge variant={r.autor === "cliente" ? "secondary" : "default"} className="capitalize shrink-0">
              {r.autor}
            </Badge>
            <div className="min-w-0">
              <span className="font-medium">{formatBRL(Number(r.valor))}</span>
              {r.mensagem && <span className="text-muted-foreground"> — {r.mensagem}</span>}
              <p className="text-[10px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        ))}
      </div>

      {podeAgir && o.status === "contraoferta" && (
        <div className="border-t pt-2 space-y-2">
          {!showContra ? (
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" onClick={() => respond.mutate({ acao: "aceitar" })} disabled={respond.isPending}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Aceitar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowContra(true)}>
                <RefreshCw className="h-3 w-3 mr-1" /> Contraofertar
              </Button>
              <Button size="sm" variant="destructive" onClick={() => respond.mutate({ acao: "recusar" })} disabled={respond.isPending}>
                <XCircle className="h-3 w-3 mr-1" /> Recusar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nova oferta (unit.)</Label>
                  <CurrencyInput value={valorContra} onValueChange={setValorContra} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mensagem</Label>
                  <Input value={msgContra} onChange={(e) => setMsgContra(e.target.value)} maxLength={500} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowContra(false)}>Cancelar</Button>
                <Button size="sm" disabled={valorContra <= 0 || respond.isPending}
                  onClick={() => respond.mutate({ acao: "contraofertar", valor: valorContra, msg: msgContra })}>
                  Enviar contraoferta
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {podeFinalizar && (
        <div className="border-t pt-2">
          <Button className="w-full" onClick={abrirWhats}>
            <Handshake className="h-4 w-4 mr-1" /> Finalizar no WhatsApp
          </Button>
        </div>
      )}

      {o.status === "pendente" && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MessageSquare className="h-3 w-3" /> Aguardando resposta do vendedor.
        </p>
      )}
    </Card>
  );
}
