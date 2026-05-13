import { useParams, Link } from "react-router-dom";
import { useTVPainelDados } from "@/hooks/useTVPaineis";
import { useEffect, useRef, useState } from "react";
import { Responsive, WidthProvider, type LayoutItem } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

const fmt = (v: number) =>
  Number(v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const fmtK = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : fmt(v);

const TAMANHOS = {
  P: { kpi: "text-xl", titulo: "text-xs", base: "text-xs" },
  M: { kpi: "text-3xl", titulo: "text-sm", base: "text-sm" },
  G: { kpi: "text-5xl", titulo: "text-base", base: "text-base" },
};

export default function TVDisplay() {
  const { codigo } = useParams<{ codigo: string }>();
  const { data, isLoading, error } = useTVPainelDados(codigo ?? null);
  const [hora, setHora] = useState(new Date());
  const containerRef = useRef<HTMLElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 1920, height: 1080 });

  useEffect(() => {
    const i = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const medir = () => {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: r.width, height: r.height });
      }
    };
    medir();
    const ro = new ResizeObserver(medir);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", medir);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, []);

  useEffect(() => {
    const goFullscreen = () => {
      if (document.documentElement.requestFullscreen)
        document.documentElement.requestFullscreen().catch(() => {});
    };
    document.addEventListener("click", goFullscreen, { once: true });
    return () => document.removeEventListener("click", goFullscreen);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <p className="text-xl text-white/60">Carregando painel...</p>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-bold">⚠️ Código inválido</h1>
        <Link to="/tv" className="text-[#00C896] underline">
          Voltar pra inserir código
        </Link>
      </div>
    );
  }

  const { painel, dados } = data;
  const widgets: string[] = painel.widgets || [];
  const tamanho: "P" | "M" | "G" = painel.tamanho_fonte || "M";
  const fontes = TAMANHOS[tamanho];

  // Layout: prioriza o salvo. Complementa widgets sem posição.
  const salvo: LayoutItem[] = (painel.layout || []) as LayoutItem[];
  const idsSalvos = new Set(salvo.map((l) => l.i));
  const faltantes: LayoutItem[] = widgets
    .filter((w) => !idsSalvos.has(w))
    .map((w, i) => ({
      i: w,
      x: ((salvo.length + i) % 3) * 4,
      y: Math.floor((salvo.length + i) / 3) * 2,
      w: 4,
      h: 2,
    }));
  const layout: LayoutItem[] = [...salvo, ...faltantes];

  const MARGIN_Y = 12;
  const maxRows = Math.max(...layout.map((l) => (l.y || 0) + (l.h || 1)), 1);
  const rowHeight = Math.max(
    50,
    Math.min(260, (containerSize.height - (maxRows + 1) * MARGIN_Y - 16) / maxRows)
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-[#00C896]/10 to-transparent">
        <div className="flex items-center gap-4">
          {painel.logo_url ? (
            <img
              src={painel.logo_url}
              alt="Logo"
              className="h-12 w-12 rounded-xl object-contain bg-white/5 p-1"
            />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-[#00C896] flex items-center justify-center text-2xl font-black">
              D
            </div>
          )}
          <div>
            <p className="text-xs text-white/60 uppercase tracking-wider">
              {painel.empresa_nome}
            </p>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">{painel.nome}</h1>
              <span className="flex items-center gap-1.5 text-xs text-[#00C896] font-semibold uppercase tracking-wider">
                <span className="h-2 w-2 rounded-full bg-[#00C896] animate-pulse" />
                AO VIVO
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-mono font-bold">
            {hora.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
          <div className="text-xs text-white/60 capitalize">
            {hora.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
      </header>

      {/* Body grid via react-grid-layout (read-only) */}
      <main className="flex-1 p-4">
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 12, sm: 12, xs: 6, xxs: 4 }}
          rowHeight={80}
          isDraggable={false}
          isResizable={false}
          margin={[12, 12]}
        >
          {layout.map((item) => (
            <div key={item.i} className="bg-[#131313] border border-white/5 rounded-lg p-4 overflow-hidden">
              {renderWidget(item.i, dados, hora, fontes)}
            </div>
          ))}
        </ResponsiveGridLayout>
      </main>

      {/* Faixa scroll */}
      <footer className="bg-[#00C896] text-black overflow-hidden py-2">
        <div className="flex gap-12 whitespace-nowrap animate-marquee font-semibold text-sm">
          {[
            `💡 ${dados.kpis?.oss_hoje ?? 0} OSs entregues hoje`,
            `🎯 Meta do mês: ${dados.meta?.pct ?? 0}% atingido`,
            dados.podio?.[0] && `🏆 Líder: ${dados.podio[0].nome} com ${dados.podio[0].oss} OSs`,
            `📦 ${dados.alertas?.estoque_baixo ?? 0} peças precisam reposição`,
            `💰 Faturamento mês: ${fmtK(dados.kpis?.faturamento_mes ?? 0)}`,
          ]
            .filter(Boolean)
            .map((msg, i) => (
              <span key={i}>{msg}</span>
            ))}
        </div>
      </footer>

      <style>{`
        @keyframes marquee {
          from { transform: translateX(100%); }
          to { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        .react-grid-item.react-grid-placeholder {
          background: rgba(0, 200, 150, 0.15) !important;
        }
      `}</style>
    </div>
  );
}

function renderWidget(id: string, dados: any, hora: Date, f: any) {
  switch (id) {
    case "kpis_dia":
      return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 h-full">
          <KPI color="#00C896" label="OSs hoje" value={dados.kpis?.oss_hoje ?? 0} f={f} />
          <KPI color="#3b82f6" label="Faturamento hoje" value={fmtK(dados.kpis?.faturamento_hoje ?? 0)} f={f} />
          <KPI color="#a855f7" label="Faturamento mês" value={fmtK(dados.kpis?.faturamento_mes ?? 0)} f={f} />
          <KPI color="#f59e0b" label="Prontos retirar" value={dados.kpis?.prontos_retirar ?? 0} f={f} />
        </div>
      );

    case "podio_tecnicos":
      return (
        <WidgetCard title="🏆 Pódio dos técnicos" f={f}>
          <div className="grid grid-cols-3 gap-2 h-full">
            {(dados.podio ?? []).slice(0, 3).map((t: any, i: number) => (
              <div
                key={i}
                className={`p-2 rounded-lg text-center flex flex-col justify-center ${
                  i === 0 ? "bg-yellow-500/20 border border-yellow-500/40"
                  : i === 1 ? "bg-gray-300/15 border border-gray-400/40"
                  : "bg-orange-700/20 border border-orange-700/40"
                }`}
              >
                <div className="text-xl font-black">{i + 1}º</div>
                <div className={`${f.base} font-semibold truncate`}>{t.nome}</div>
                <div className={`${f.kpi} font-bold text-[#00C896]`}>{t.oss}</div>
              </div>
            ))}
            {(!dados.podio || dados.podio.length === 0) && (
              <p className="col-span-3 text-center text-sm text-white/50 py-4">Sem dados</p>
            )}
          </div>
        </WidgetCard>
      );

    case "aparelhos_tecnicos": {
      const max = Math.max(1, ...(dados.aparelhos_tecnicos ?? []).map((x: any) => x.qtd));
      return (
        <WidgetCard title="📋 Aparelhos por técnico" f={f}>
          <div className="space-y-2 overflow-auto h-full">
            {(dados.aparelhos_tecnicos ?? []).map((t: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`${f.base} w-28 truncate`}>{t.nome}</span>
                <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${(t.qtd / max) * 100}%` }} />
                </div>
                <span className={`${f.base} font-bold w-6 text-right`}>{t.qtd}</span>
              </div>
            ))}
            {(!dados.aparelhos_tecnicos || dados.aparelhos_tecnicos.length === 0) && (
              <p className="text-center text-sm text-white/50 py-4">Nenhum aparelho aberto</p>
            )}
          </div>
        </WidgetCard>
      );
    }

    case "alertas":
      return (
        <WidgetCard title="⏰ Atenção" f={f}>
          <div className="space-y-2">
            {(dados.alertas?.prontas_paradas ?? 0) > 0 && (
              <Alerta cor="red" texto={`${dados.alertas.prontas_paradas} OSs prontas há +7 dias`} f={f} />
            )}
            {(dados.alertas?.aguardando_aprovacao_2dias ?? 0) > 0 && (
              <Alerta cor="amber" texto={`${dados.alertas.aguardando_aprovacao_2dias} aguardando aprovação`} f={f} />
            )}
            {(dados.alertas?.estoque_baixo ?? 0) > 0 && (
              <Alerta cor="blue" texto={`${dados.alertas.estoque_baixo} peças abaixo do mínimo`} f={f} />
            )}
            {!(dados.alertas?.prontas_paradas || dados.alertas?.aguardando_aprovacao_2dias || dados.alertas?.estoque_baixo) && (
              <p className="text-center text-sm text-white/50 py-4">✅ Tudo em ordem!</p>
            )}
          </div>
        </WidgetCard>
      );

    case "meta_mes":
      return (
        <WidgetCard title="🎯 Meta do mês" f={f}>
          <div className="flex flex-col justify-center h-full">
            <div className="flex items-baseline gap-2 mb-2 flex-wrap">
              <span className={`${f.kpi} font-black text-[#00C896]`}>{fmt(dados.meta?.atual_valor ?? 0)}</span>
              <span className={`${f.base} text-white/60`}>de {fmt(dados.meta?.meta_valor ?? 0)}</span>
            </div>
            <div className="h-3 bg-white/5 rounded-full overflow-hidden mb-1">
              <div className="h-full bg-gradient-to-r from-[#00C896] to-[#00b389]" style={{ width: `${Math.min(dados.meta?.pct ?? 0, 100)}%` }} />
            </div>
            <p className={`${f.base} font-bold text-[#00C896] text-right`}>{dados.meta?.pct ?? 0}%</p>
          </div>
        </WidgetCard>
      );

    case "top_lojistas": {
      const max = Math.max(1, ...(dados.top_lojistas ?? []).map((x: any) => x.saldo));
      return (
        <WidgetCard title="🏪 Top lojistas (saldo)" f={f}>
          <div className="space-y-2 overflow-auto h-full">
            {(dados.top_lojistas ?? []).map((l: any, i: number) => {
              const cor = l.saldo > 30000 ? "bg-red-500" : l.saldo > 20000 ? "bg-amber-500" : "bg-yellow-500";
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className={`${f.base} w-28 truncate`}>{l.nome}</span>
                  <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
                    <div className={`h-full ${cor}`} style={{ width: `${(l.saldo / max) * 100}%` }} />
                  </div>
                  <span className={`${f.base} font-bold w-16 text-right`}>{fmtK(l.saldo)}</span>
                </div>
              );
            })}
            {(!dados.top_lojistas || dados.top_lojistas.length === 0) && (
              <p className="text-center text-sm text-white/50 py-4">Nada pra cobrar</p>
            )}
          </div>
        </WidgetCard>
      );
    }

    case "estoque_critico":
      return (
        <WidgetCard title="📦 Estoque crítico" f={f}>
          <div className="space-y-1.5 overflow-auto h-full">
            {(dados.estoque_critico ?? []).length === 0 ? (
              <p className="text-center text-sm text-white/50 py-4">✓ Estoque OK</p>
            ) : (
              (dados.estoque_critico ?? []).map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-2 p-1.5 bg-red-500/5 border border-red-500/20 rounded">
                  <span className={`${f.base} truncate flex-1`}>{p.nome}</span>
                  <span className={`${f.base} font-mono font-bold text-red-400`}>
                    {p.quantidade}/{p.minimo}
                  </span>
                </div>
              ))
            )}
          </div>
        </WidgetCard>
      );

    case "financeiro_mes": {
      const fin = dados.financeiro_mes ?? {};
      const lucro = (fin.receita || 0) - (fin.custos_pecas || 0) - (fin.despesas || 0);
      return (
        <WidgetCard title="💰 Financeiro do mês" f={f}>
          <div className="grid grid-cols-3 gap-2 h-full">
            <div className="flex flex-col justify-center">
              <p className="text-[10px] text-white/60 uppercase">Receita</p>
              <p className={`${f.kpi} font-black text-[#00C896]`}>{fmtK(fin.receita || 0)}</p>
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-[10px] text-white/60 uppercase">Custos</p>
              <p className={`${f.kpi} font-black text-red-400`}>-{fmtK((fin.custos_pecas || 0) + (fin.despesas || 0))}</p>
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-[10px] text-white/60 uppercase">Lucro</p>
              <p className={`${f.kpi} font-black ${lucro >= 0 ? "text-[#00C896]" : "text-red-500"}`}>{fmtK(lucro)}</p>
            </div>
          </div>
        </WidgetCard>
      );
    }

    case "ultimas_oss":
      return (
        <WidgetCard title="🔔 Últimas OSs entregues" f={f}>
          <div className="space-y-1.5 overflow-auto h-full">
            {(dados.ultimas_oss ?? []).length === 0 ? (
              <p className="text-center text-sm text-white/50 py-4">Sem OSs entregues</p>
            ) : (
              (dados.ultimas_oss ?? []).map((os: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-1.5 bg-white/5 rounded">
                  <span className={`${f.base} font-mono font-bold text-[#00C896]`}>#{os.numero}</span>
                  <span className={`${f.base} flex-1 truncate text-white/80`}>{os.tecnico || "—"}</span>
                  <span className={`${f.base} font-bold`}>{fmtK(os.valor)}</span>
                </div>
              ))
            )}
          </div>
        </WidgetCard>
      );

    case "agenda_dia":
      return (
        <WidgetCard title="📅 Agenda do dia" f={f}>
          <div className="space-y-1.5 overflow-auto h-full">
            {(dados.agenda_dia ?? []).length === 0 ? (
              <p className="text-center text-sm text-white/50 py-4">Sem OSs com previsão hoje</p>
            ) : (
              (dados.agenda_dia ?? []).map((os: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-1.5 bg-white/5 rounded">
                  <span className={`${f.base} font-mono font-bold text-blue-400`}>#{os.numero}</span>
                  <span className={`${f.base} flex-1 truncate text-white/80`}>{os.tecnico || "—"}</span>
                  {os.prioridade === "urgente" && (
                    <span className="text-[10px] font-bold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase">URG</span>
                  )}
                </div>
              ))
            )}
          </div>
        </WidgetCard>
      );

    case "contas_vencer":
      return (
        <WidgetCard title="⏳ Contas a vencer" f={f}>
          <div className="space-y-1.5 overflow-auto h-full">
            {(dados.contas_vencer ?? []).length === 0 ? (
              <p className="text-center text-sm text-white/50 py-4">✓ Sem contas próximas</p>
            ) : (
              (dados.contas_vencer ?? []).map((c: any, i: number) => {
                const cor = c.dias <= 2 ? "text-red-400 bg-red-500/10" : "text-amber-400 bg-amber-500/10";
                return (
                  <div key={i} className="flex items-center gap-2 p-1.5 bg-white/5 rounded">
                    <span className={`${f.base} flex-1 truncate text-white/80`}>{c.descricao}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cor}`}>
                      {c.dias === 0 ? "hoje" : `${c.dias}d`}
                    </span>
                    <span className={`${f.base} font-bold`}>{fmtK(c.valor)}</span>
                  </div>
                );
              })
            )}
          </div>
        </WidgetCard>
      );

    case "graf_semanal": {
      const max = Math.max(1, ...(dados.graf_semanal ?? []).map((s: any) => s.receita));
      return (
        <WidgetCard title="📈 Receita últimas 4 semanas" f={f}>
          <div className="flex items-end justify-around gap-2 h-full pt-2">
            {(dados.graf_semanal ?? []).map((s: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
                <span className="text-[10px] font-bold text-white/80">{fmtK(s.receita)}</span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full bg-gradient-to-t from-[#00C896] to-[#00b389] rounded-t"
                    style={{ height: `${(s.receita / max) * 100}%`, minHeight: "4px" }}
                  />
                </div>
                <span className="text-[10px] text-white/60">{s.semana}</span>
              </div>
            ))}
          </div>
        </WidgetCard>
      );
    }

    case "ranking_lojistas":
      return (
        <WidgetCard title="🏪 Top lojistas (volume)" f={f}>
          <div className="space-y-1.5 overflow-auto h-full">
            {(dados.ranking_lojistas ?? []).length === 0 ? (
              <p className="text-center text-sm text-white/50 py-4">Sem dados</p>
            ) : (
              (dados.ranking_lojistas ?? []).map((l: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-1.5 bg-white/5 rounded">
                  <span className="text-lg font-black text-purple-400 w-6 text-center">{i + 1}</span>
                  <span className={`${f.base} flex-1 truncate text-white/80`}>{l.nome}</span>
                  <span className={`${f.base} font-bold`}>{l.qtd_oss} OSs</span>
                </div>
              ))
            )}
          </div>
        </WidgetCard>
      );

    case "ticket_medio": {
      const arr = (dados.ticket_medio ?? []).map((m: any) => ({ ...m, _val: parseFloat(m.ticket) }));
      const max = Math.max(1, ...arr.map((m: any) => m._val));
      return (
        <WidgetCard title="💵 Ticket médio (6 meses)" f={f}>
          <div className="flex items-end justify-around gap-1 h-full pt-2">
            {arr.map((m: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
                <span className="text-[9px] font-bold text-white/80">{fmt(m._val)}</span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full bg-gradient-to-t from-pink-500 to-pink-400 rounded-t"
                    style={{ height: `${(m._val / max) * 100}%`, minHeight: "4px" }}
                  />
                </div>
                <span className="text-[9px] text-white/60">{m.mes}</span>
              </div>
            ))}
          </div>
        </WidgetCard>
      );
    }

    case "top_defeitos": {
      const max = Math.max(1, ...(dados.top_defeitos ?? []).map((d: any) => d.qtd));
      return (
        <WidgetCard title="🔧 Top defeitos do mês" f={f}>
          <div className="space-y-2 overflow-auto h-full">
            {(dados.top_defeitos ?? []).length === 0 ? (
              <p className="text-center text-sm text-white/50 py-4">Sem dados</p>
            ) : (
              (dados.top_defeitos ?? []).map((d: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`${f.base} w-28 truncate`}>{d.defeito}</span>
                  <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
                    <div className="h-full bg-cyan-500" style={{ width: `${(d.qtd / max) * 100}%` }} />
                  </div>
                  <span className={`${f.base} font-bold w-6 text-right`}>{d.qtd}</span>
                </div>
              ))
            )}
          </div>
        </WidgetCard>
      );
    }

    case "clima_relogio":
      return (
        <div className="h-full flex flex-col items-center justify-center">
          <p className={`${f.kpi} font-black font-mono`}>
            {hora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className={`${f.base} text-white/60 capitalize`}>
            {hora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
        </div>
      );

    default:
      return <p className="text-white/40 text-sm">{id}</p>;
  }
}

function WidgetCard({ title, children, f }: any) {
  return (
    <div className="h-full flex flex-col">
      <h3 className={`${f.titulo} font-semibold text-white/80 uppercase tracking-wider mb-2`}>
        {title}
      </h3>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function KPI({ color, label, value, f }: any) {
  return (
    <div
      className="rounded-lg p-3 flex flex-col justify-center"
      style={{ borderLeft: `4px solid ${color}`, background: "rgba(255,255,255,0.03)" }}
    >
      <p className="text-[10px] text-white/60 uppercase tracking-wide">{label}</p>
      <p className={`${f.kpi} font-black mt-1`}>{value}</p>
    </div>
  );
}

function Alerta({ cor, texto, f }: any) {
  const cores: Record<string, string> = {
    red: "bg-red-500/10 border-red-500/30",
    amber: "bg-amber-500/10 border-amber-500/30",
    blue: "bg-blue-500/10 border-blue-500/30",
  };
  return (
    <div className={`p-2 rounded-lg border ${cores[cor]} ${f.base} font-semibold`}>{texto}</div>
  );
}
