import { useState, useEffect } from "react";
import { Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DittLogo } from "@/components/DittLogo";
import { formatBRL } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const MOTIVACIONAIS = [
  "Cada cliente atendido é uma chance de virar lenda.",
  "Vendedor que não sorri perde venda.",
  "O melhor pós-venda é o cliente voltando.",
  "Bata a meta hoje. Surpreenda amanhã.",
  "Trabalhar bem é fácil. O difícil é entregar valor.",
];

export default function LojaTV() {
  const { empresaId } = useEmpresa();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [motivIdx, setMotivIdx] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.fullscreen = "loja-tv";
    return () => {
      delete document.documentElement.dataset.fullscreen;
    };
  }, []);

  useEffect(() => {
    const t1 = setInterval(() => setNow(new Date()), 1000);
    const t2 = setInterval(() => setMotivIdx((i) => (i + 1) % MOTIVACIONAIS.length), 8000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, []);

  const inicioDia = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();

  const { data: vendasHoje = [] } = useQuery({
    queryKey: ["tv-vendas-hoje", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("loja_vendas")
        .select(
          `id, total, created_at, vendedor_id, funcionarios(nome), loja_vendas_itens(loja_aparelhos(modelo, capacidade, cor))`,
        )
        .eq("empresa_id", empresaId)
        .eq("status", "pago")
        .gte("created_at", inicioDia)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
    refetchInterval: 30_000,
  });

  const faturamentoDia = vendasHoje.reduce((s: number, v: any) => s + Number(v.total), 0);
  const qtd = vendasHoje.length;
  const ticket = qtd > 0 ? faturamentoDia / qtd : 0;

  const ranking = Object.entries(
    vendasHoje.reduce((acc: Record<string, { nome: string; total: number; qtd: number }>, v: any) => {
      const id = v.vendedor_id ?? "sem-vendedor";
      if (!acc[id]) acc[id] = { nome: v.funcionarios?.nome ?? "Sem vendedor", total: 0, qtd: 0 };
      acc[id].total += Number(v.total);
      acc[id].qtd++;
      return acc;
    }, {}),
  )
    .map(([id, info]) => ({ id, ...(info as { nome: string; total: number; qtd: number }) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  const maxTotal = ranking[0]?.total || 1;

  const enterFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground overflow-hidden flex flex-col p-6 lg:p-10 font-[Manrope]">
      <header className="flex items-center justify-between mb-6 lg:mb-10">
        <div className="flex items-center gap-4">
          <DittLogo size="lg" />
          <span className="text-lg lg:text-2xl font-semibold text-muted-foreground">
            Loja · Telão
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-3xl lg:text-5xl font-bold tabular-nums">
              {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-sm lg:text-base text-muted-foreground">
              {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={enterFullscreen} aria-label="Tela cheia">
            <Maximize2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => navigate("/loja/dashboard")} aria-label="Sair">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 mb-6 lg:mb-10">
        <div className="rounded-3xl border border-border bg-card p-8 lg:p-10">
          <p className="text-base lg:text-lg uppercase text-muted-foreground font-semibold tracking-wider">
            Faturamento do dia
          </p>
          <p className="text-6xl lg:text-8xl font-bold mt-4 text-primary tabular-nums">
            {formatBRL(faturamentoDia)}
          </p>
          <div className="flex gap-8 mt-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase">Vendas</p>
              <p className="text-2xl lg:text-3xl font-bold">{qtd}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Ticket médio</p>
              <p className="text-2xl lg:text-3xl font-bold">{formatBRL(ticket)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-8 lg:p-10">
          <p className="text-base lg:text-lg uppercase text-muted-foreground font-semibold tracking-wider mb-6">
            Ranking ao vivo
          </p>
          {ranking.length === 0 ? (
            <div className="h-32 flex items-center justify-center">
              <p className="text-xl text-muted-foreground italic">
                Aguardando primeira venda do dia...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {ranking.map((v, i) => {
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
                const pct = (v.total / maxTotal) * 100;
                return (
                  <div key={v.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-2xl lg:text-3xl">
                        {medal} <span className="font-semibold">{v.nome}</span>
                      </span>
                      <span className="text-xl lg:text-2xl font-bold tabular-nums">
                        {formatBRL(v.total)}
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 rounded-3xl border border-border bg-card p-8 lg:p-10 overflow-hidden">
        <p className="text-base lg:text-lg uppercase text-muted-foreground font-semibold tracking-wider mb-4">
          Últimas vendas
        </p>
        {vendasHoje.length === 0 ? (
          <p className="text-xl text-muted-foreground italic">Nenhuma venda hoje ainda.</p>
        ) : (
          <div className="space-y-3">
            {vendasHoje.slice(0, 5).map((v: any) => {
              const ap = v.loja_vendas_itens?.[0]?.loja_aparelhos;
              return (
                <div
                  key={v.id}
                  className="grid grid-cols-[80px_1fr_auto_auto] items-center gap-4 text-lg lg:text-xl border-b border-border/50 pb-2"
                >
                  <span className="text-muted-foreground tabular-nums">
                    {new Date(v.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="font-medium truncate">
                    {ap ? `${ap.modelo} ${ap.capacidade ?? ""} ${ap.cor ?? ""}`.trim() : "Venda"}
                  </span>
                  <span className="font-bold text-primary tabular-nums">{formatBRL(v.total)}</span>
                  <span className="text-muted-foreground text-base">{v.funcionarios?.nome ?? "—"}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer className="mt-6 lg:mt-8 text-center">
        <p className="text-xl lg:text-2xl text-muted-foreground italic">
          💚 "{MOTIVACIONAIS[motivIdx]}"
        </p>
      </footer>
    </div>
  );
}
