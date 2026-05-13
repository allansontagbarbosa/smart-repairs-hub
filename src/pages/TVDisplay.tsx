import { useParams, Link } from "react-router-dom";
import { useTVPainelDados } from "@/hooks/useTVPaineis";
import { useEffect, useState } from "react";

const fmt = (v: number) =>
  Number(v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const fmtK = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : fmt(v);

export default function TVDisplay() {
  const { codigo } = useParams<{ codigo: string }>();
  const { data, isLoading, error } = useTVPainelDados(codigo ?? null);
  const [hora, setHora] = useState(new Date());

  useEffect(() => {
    const i = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(i);
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-[#00C896]/10 to-transparent">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-[#00C896] flex items-center justify-center text-2xl font-black">
            D
          </div>
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

      {/* Body grid */}
      <main className="flex-1 grid grid-cols-12 auto-rows-min gap-4 p-4 sm:p-6">
        {widgets.includes("kpis_dia") && (
          <>
            <KPICard
              color="green"
              label="OSs entregues hoje"
              value={dados.kpis?.oss_hoje ?? 0}
              sub={`${dados.kpis?.aparelhos_abertos ?? 0} abertas`}
            />
            <KPICard
              color="blue"
              label="Faturamento hoje"
              value={fmt(dados.kpis?.faturamento_hoje ?? 0)}
              sub="serviços entregues"
            />
            <KPICard
              color="purple"
              label="Faturamento mês"
              value={fmtK(dados.kpis?.faturamento_mes ?? 0)}
              sub="acumulado"
            />
            <KPICard
              color="orange"
              label="Prontos pra retirar"
              value={dados.kpis?.prontos_retirar ?? 0}
              sub="aguardando cliente"
            />
          </>
        )}

        {widgets.includes("podio_tecnicos") && (
          <Widget title="🏆 Pódio dos técnicos" colSpan={6}>
            <div className="grid grid-cols-3 gap-3">
              {(dados.podio ?? []).map((t: any, i: number) => (
                <div
                  key={i}
                  className={`p-4 rounded-xl text-center ${
                    i === 0
                      ? "bg-gradient-to-b from-yellow-500/30 to-yellow-600/10 border border-yellow-500/40"
                      : i === 1
                      ? "bg-gradient-to-b from-gray-300/20 to-gray-400/10 border border-gray-400/40"
                      : "bg-gradient-to-b from-orange-700/20 to-orange-800/10 border border-orange-700/40"
                  }`}
                >
                  <div className="text-3xl font-black mb-1">{i + 1}º</div>
                  <div className="text-sm font-semibold truncate">{t.nome}</div>
                  <div className="mt-2 space-y-0.5">
                    <p className="text-2xl font-bold text-[#00C896]">{t.oss}</p>
                    <p className="text-[10px] text-white/60 uppercase">OSs</p>
                    <p className="text-xs text-white/80 mt-1">{fmt(t.comissao || 0)}</p>
                  </div>
                </div>
              ))}
              {(!dados.podio || dados.podio.length === 0) && (
                <p className="col-span-3 text-center text-sm text-white/50 py-6">
                  Sem comissões no mês ainda
                </p>
              )}
            </div>
          </Widget>
        )}

        {widgets.includes("aparelhos_tecnicos") && (
          <Widget title="📋 Aparelhos por técnico" colSpan={6}>
            <div className="space-y-2">
              {(dados.aparelhos_tecnicos ?? []).map((t: any, i: number) => {
                const max = Math.max(
                  1,
                  ...(dados.aparelhos_tecnicos ?? []).map((x: any) => x.qtd),
                );
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm w-32 truncate">{t.nome}</span>
                    <div className="flex-1 h-6 bg-white/5 rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded transition-all"
                        style={{ width: `${(t.qtd / max) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold w-8 text-right">{t.qtd}</span>
                  </div>
                );
              })}
              {(!dados.aparelhos_tecnicos || dados.aparelhos_tecnicos.length === 0) && (
                <p className="text-center text-sm text-white/50 py-6">
                  Nenhum aparelho aberto
                </p>
              )}
            </div>
          </Widget>
        )}

        {widgets.includes("alertas") && (
          <Widget title="⏰ Atenção necessária" colSpan={6}>
            <div className="space-y-2">
              {(dados.alertas?.prontas_paradas ?? 0) > 0 && (
                <AlertaItem
                  icon="🚨"
                  color="red"
                  titulo={`${dados.alertas.prontas_paradas} OSs prontas há +7 dias`}
                  sub="Cliente não veio retirar"
                />
              )}
              {(dados.alertas?.aguardando_aprovacao_2dias ?? 0) > 0 && (
                <AlertaItem
                  icon="⏳"
                  color="amber"
                  titulo={`${dados.alertas.aguardando_aprovacao_2dias} aguardando aprovação +2d`}
                  sub="Ligar pro cliente"
                />
              )}
              {(dados.alertas?.estoque_baixo ?? 0) > 0 && (
                <AlertaItem
                  icon="📦"
                  color="blue"
                  titulo={`${dados.alertas.estoque_baixo} peças abaixo do mínimo`}
                  sub="Hora de repor"
                />
              )}
              {!(dados.alertas?.prontas_paradas || dados.alertas?.aguardando_aprovacao_2dias || dados.alertas?.estoque_baixo) && (
                <p className="text-center text-sm text-white/50 py-6">
                  ✅ Tudo em ordem!
                </p>
              )}
            </div>
          </Widget>
        )}

        {widgets.includes("meta_mes") && (
          <Widget title="🎯 Meta do mês" colSpan={6}>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-3xl font-black text-[#00C896]">
                {fmt(dados.meta?.atual_valor ?? 0)}
              </span>
              <span className="text-sm text-white/60">de {fmt(dados.meta?.meta_valor ?? 0)}</span>
            </div>
            <div className="h-4 bg-white/5 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-[#00C896] to-[#00b389] rounded-full transition-all"
                style={{ width: `${dados.meta?.pct ?? 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-white/60">
              <span>↗ ritmo atual</span>
              <span className="font-bold text-[#00C896]">{dados.meta?.pct ?? 0}% atingido</span>
            </div>
          </Widget>
        )}

        {widgets.includes("top_lojistas") && (
          <Widget title="🏪 Top lojistas (saldo a receber)" colSpan={6}>
            <div className="space-y-2">
              {(dados.top_lojistas ?? []).map((l: any, i: number) => {
                const max = Math.max(1, ...(dados.top_lojistas ?? []).map((x: any) => x.saldo));
                const cor =
                  l.saldo > 30000 ? "bg-red-500" : l.saldo > 20000 ? "bg-amber-500" : "bg-yellow-500";
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm w-32 truncate">{l.nome}</span>
                    <div className="flex-1 h-6 bg-white/5 rounded overflow-hidden">
                      <div
                        className={`h-full ${cor} rounded transition-all`}
                        style={{ width: `${(l.saldo / max) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold w-20 text-right">{fmtK(l.saldo)}</span>
                  </div>
                );
              })}
              {(!dados.top_lojistas || dados.top_lojistas.length === 0) && (
                <p className="text-center text-sm text-white/50 py-6">Nada pra cobrar</p>
              )}
            </div>
          </Widget>
        )}

        {widgets.includes("financeiro_mes") && (
          <Widget title="💰 Financeiro do mês" colSpan={6}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-white/60 uppercase">Receita</p>
                <p className="text-2xl font-bold text-[#00C896]">{fmtK(dados.kpis?.faturamento_mes ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-white/60 uppercase">Meta</p>
                <p className="text-2xl font-bold">{fmtK(dados.meta?.meta_valor ?? 0)}</p>
              </div>
            </div>
          </Widget>
        )}

        {widgets.includes("estoque_critico") && (
          <Widget title="📦 Estoque crítico" colSpan={6}>
            <div className="text-center py-4">
              <p className="text-5xl font-black text-amber-400">
                {dados.alertas?.estoque_baixo ?? 0}
              </p>
              <p className="text-sm text-white/60 mt-2">peças abaixo do mínimo</p>
            </div>
          </Widget>
        )}

        {widgets.includes("clima_relogio") && (
          <Widget title="🌡️ Hora atual" colSpan={6}>
            <div className="text-center py-4">
              <p className="text-5xl font-black font-mono">
                {hora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-sm text-white/60 mt-2 capitalize">
                {hora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </p>
            </div>
          </Widget>
        )}
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
      `}</style>
    </div>
  );
}

function KPICard({ color, label, value, sub }: any) {
  const cores: Record<string, string> = {
    green: "border-l-[#00C896]",
    blue: "border-l-blue-500",
    purple: "border-l-purple-500",
    orange: "border-l-amber-500",
  };
  return (
    <div className={`col-span-12 sm:col-span-6 lg:col-span-3 bg-[#131313] border-l-4 ${cores[color]} rounded-lg p-4`}>
      <p className="text-xs text-white/60 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-black mt-1">{value}</p>
      <p className="text-xs text-white/50 mt-1">{sub}</p>
    </div>
  );
}

function Widget({ title, children, colSpan = 6 }: any) {
  const spanCls: Record<number, string> = {
    3: "lg:col-span-3",
    4: "lg:col-span-4",
    6: "lg:col-span-6",
    8: "lg:col-span-8",
    9: "lg:col-span-9",
    12: "lg:col-span-12",
  };
  return (
    <div className={`col-span-12 ${spanCls[colSpan] ?? "lg:col-span-6"} bg-[#131313] border border-white/5 rounded-lg p-5`}>
      <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

function AlertaItem({ icon, color, titulo, sub }: any) {
  const cores: Record<string, string> = {
    red: "bg-red-500/10 border-red-500/30",
    amber: "bg-amber-500/10 border-amber-500/30",
    blue: "bg-blue-500/10 border-blue-500/30",
  };
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${cores[color]}`}>
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <p className="font-semibold text-sm">{titulo}</p>
        <p className="text-xs text-white/60">{sub}</p>
      </div>
    </div>
  );
}
