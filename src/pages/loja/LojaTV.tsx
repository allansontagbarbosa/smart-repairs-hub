import { useState, useEffect, useRef } from "react";
import { Maximize2, Minimize2, X, TrendingUp, Trophy, Flame } from "lucide-react";
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
  "Quem treina, vende. Quem vende, conquista.",
  "A loja é o palco. Cada venda é o seu show.",
  "Cliente novo nasce de um cliente bem atendido.",
  "Foco na meta. Coração no cliente.",
  "Hoje tem que ser melhor que ontem.",
];

export default function LojaTV() {
  const { empresaId } = useEmpresa();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [motivIdx, setMotivIdx] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [destacar, setDestacar] = useState(false);
  const metaJaBatidaRef = useRef(false);
  const fatAnteriorRef = useRef(0);

  // Relógio + frase
  useEffect(() => {
    const t1 = setInterval(() => setNow(new Date()), 1000);
    const t2 = setInterval(() => setMotivIdx((i) => (i + 1) % MOTIVACIONAIS.length), 8000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  // Fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const hojeStart = new Date(); hojeStart.setHours(0, 0, 0, 0);
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  const { data: vendasHoje = [] } = useQuery({
    queryKey: ["tv-vendas-hoje", empresaId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("loja_vendas")
        .select(`id, total, created_at, vendedor_id, funcionarios(nome), loja_vendas_itens(loja_aparelhos(modelo, capacidade, cor))`)
        .eq("empresa_id", empresaId)
        .eq("status", "pago")
        .gte("created_at", hojeStart.toISOString())
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!empresaId,
    refetchInterval: 30_000,
  });

  const { data: faturamentoMes = 0 } = useQuery({
    queryKey: ["tv-fat-mes", empresaId, ano, mes],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("loja_vendas")
        .select("total")
        .eq("empresa_id", empresaId)
        .eq("status", "pago")
        .gte("created_at", inicioMes.toISOString())
        .is("deleted_at", null);
      return (data ?? []).reduce((s: number, v: any) => s + Number(v.total), 0);
    },
    enabled: !!empresaId,
    refetchInterval: 60_000,
  });

  const { data: meta } = useQuery({
    queryKey: ["tv-meta", empresaId, ano, mes],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("loja_metas")
        .select("valor_meta")
        .eq("empresa_id", empresaId)
        .eq("competencia_ano", ano)
        .eq("competencia_mes", mes)
        .eq("tipo", "faturamento")
        .is("funcionario_id", null)
        .maybeSingle();
      return data;
    },
    enabled: !!empresaId,
    refetchInterval: 120_000,
  });

  const valorMeta = Number(meta?.valor_meta ?? 0);
  const pctMeta = valorMeta > 0 ? (Number(faturamentoMes) / valorMeta) * 100 : 0;

  // Celebra ao bater meta
  useEffect(() => {
    if (pctMeta >= 100 && !metaJaBatidaRef.current) {
      metaJaBatidaRef.current = true;
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 8000);
    }
  }, [pctMeta]);

  const faturamentoDia = (vendasHoje as any[]).reduce((s, v) => s + Number(v.total), 0);
  const qtd = (vendasHoje as any[]).length;
  const ticket = qtd > 0 ? faturamentoDia / qtd : 0;

  // Destaca quando faturamento sobe
  useEffect(() => {
    if (faturamentoDia > fatAnteriorRef.current && fatAnteriorRef.current > 0) {
      setDestacar(true);
      const t = setTimeout(() => setDestacar(false), 1500);
      return () => clearTimeout(t);
    }
    fatAnteriorRef.current = faturamentoDia;
  }, [faturamentoDia]);

  const ranking = Object.values(
    (vendasHoje as any[]).reduce((acc: Record<string, any>, v: any) => {
      const id = v.vendedor_id ?? "sem";
      if (!acc[id]) acc[id] = { id, nome: v.funcionarios?.nome ?? "—", total: 0, qtd: 0 };
      acc[id].total += Number(v.total);
      acc[id].qtd++;
      return acc;
    }, {})
  ).sort((a: any, b: any) => b.total - a.total).slice(0, 5);

  const maxTotal = (ranking[0] as any)?.total || 1;

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <>
      {celebrate && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-success/90 to-primary/90 flex items-center justify-center animate-fade-in">
          <div className="text-center text-primary-foreground">
            <div className="text-9xl mb-4 animate-bounce">🎉</div>
            <div className="text-7xl font-black tracking-tight">META BATIDA!</div>
            <div className="text-2xl mt-4 opacity-90">{formatBRL(Number(faturamentoMes))} de {formatBRL(valorMeta)}</div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 bg-background text-foreground overflow-y-auto p-6 lg:p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <DittLogo size="md" />
            <span className="text-sm text-muted-foreground uppercase tracking-widest">Loja · Telão</span>
            {qtd > 0 && (
              <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-success/15 text-success border border-success/30">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                Ao vivo
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums">
                {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="text-xs text-muted-foreground capitalize">
                {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </div>
            </div>
            <Button size="icon" variant="outline" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="outline" onClick={() => navigate("/loja/dashboard")} title="Voltar">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 flex-1">
          {/* Faturamento + Meta */}
          <div className="rounded-2xl border bg-card p-6 lg:p-8 flex flex-col">
            <div className="text-sm uppercase tracking-widest text-muted-foreground">Faturamento do dia</div>
            <div className={`text-6xl lg:text-7xl xl:text-8xl font-black tabular-nums mt-3 transition-all duration-500 ${destacar ? "text-success scale-105" : "text-foreground"}`}>
              {formatBRL(faturamentoDia)}
            </div>
            <div className="flex items-center gap-6 mt-4 text-base">
              <div><span className="text-2xl font-bold">{qtd}</span> <span className="text-muted-foreground">vendas</span></div>
              <div><span className="text-muted-foreground">Ticket médio</span> <span className="font-bold">{formatBRL(ticket)}</span></div>
            </div>

            {valorMeta > 0 && (
              <div className="mt-auto pt-6 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground uppercase tracking-wider">Meta do mês</span>
                  <span className="tabular-nums font-semibold">
                    {formatBRL(Number(faturamentoMes))} / {formatBRL(valorMeta)}
                  </span>
                </div>
                <div className="h-4 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${pctMeta >= 100 ? "bg-success" : pctMeta >= 80 ? "bg-warning" : "bg-primary"}`}
                    style={{ width: `${Math.min(100, pctMeta)}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {pctMeta.toFixed(1)}% {pctMeta >= 100 ? "🎯 batida!" : pctMeta >= 80 ? "🔥 quase lá" : ""}
                </div>
              </div>
            )}
          </div>

          {/* Ranking */}
          <div className="rounded-2xl border bg-card p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-5">
              <Trophy className="h-5 w-5 text-warning" />
              <h2 className="text-lg font-bold uppercase tracking-wider">Ranking ao vivo</h2>
            </div>
            {ranking.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                Aguardando primeira venda do dia...
              </div>
            ) : (
              <div className="space-y-3">
                {ranking.map((v: any, i) => {
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
                  const pct = (v.total / maxTotal) * 100;
                  return (
                    <div key={v.id} className="space-y-1">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-xl w-8">{medal}</span>
                        <span className="font-semibold flex-1 truncate">{v.nome}</span>
                        <span className="text-xs text-muted-foreground">{v.qtd}v</span>
                        <span className="font-bold tabular-nums">{formatBRL(v.total)}</span>
                      </div>
                      <div className="h-2 ml-11 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Últimas vendas */}
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold uppercase tracking-wider">Últimas vendas</h2>
          </div>
          {(vendasHoje as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma venda hoje ainda — vamos lá!</p>
          ) : (
            <div className="divide-y divide-border">
              {(vendasHoje as any[]).slice(0, 5).map((v: any) => (
                <div key={v.id} className="grid grid-cols-[80px_1fr_auto_auto] items-center gap-4 py-2.5 text-sm animate-fade-in">
                  <span className="text-muted-foreground tabular-nums">
                    {new Date(v.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="truncate">
                    {v.loja_vendas_itens?.[0]?.loja_aparelhos
                      ? `${v.loja_vendas_itens[0].loja_aparelhos.modelo} ${v.loja_vendas_itens[0].loja_aparelhos.capacidade ?? ""} ${v.loja_vendas_itens[0].loja_aparelhos.cor ?? ""}`
                      : "Venda"}
                  </span>
                  <span className="font-bold tabular-nums">{formatBRL(Number(v.total))}</span>
                  <span className="text-xs text-muted-foreground w-24 truncate text-right">{v.funcionarios?.nome ?? ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Frase motivacional */}
        <div className="rounded-2xl border border-primary/30 bg-primary/5 px-6 py-5 text-center">
          <div className="flex items-center justify-center gap-2 text-lg lg:text-xl italic text-primary font-medium">
            <Flame className="h-5 w-5 shrink-0" />
            <span key={motivIdx} className="animate-fade-in">"{MOTIVACIONAIS[motivIdx]}"</span>
          </div>
        </div>
      </div>
    </>
  );
}
