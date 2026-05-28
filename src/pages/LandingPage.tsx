import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_CONFIG } from "@/config/app";
import { ArrowRight, Sparkles, Check, Play, MessageCircle, ChevronRight } from "lucide-react";

const stats = [
  { value: "+40%", label: "Mais OSs entregues no prazo" },
  { value: "-65%", label: "Tempo gasto em planilha" },
  { value: "3x", label: "Mais agilidade na fila" },
  { value: "100%", label: "Visibilidade do financeiro" },
];

const faqs = [
  { q: "Quanto tempo leva pra migrar do meu sistema atual?", a: "Migração assistida em até 48 horas. Trazemos clientes, aparelhos, OSs abertas e histórico financeiro do seu sistema atual. Vem com checagem da nossa equipe pra garantir que ficou tudo certo. Migração é grátis em todos os planos." },
  { q: "Funciona em quantos aparelhos ao mesmo tempo?", a: "Ilimitado. Atendimento no PC, técnico no tablet, gestor no celular, painel TV na parede da oficina. Tudo sincronizado em tempo real via WebSocket." },
  { q: "Os clientes finais precisam pagar pra usar o portal?", a: "Não. O portal do cliente é grátis pra eles. Você inclui o acesso quando cadastra cada cliente — ele recebe e-mail com link de primeiro acesso." },
  { q: "A Fila IA cobra à parte?", a: "Não. Fila IA está incluída no plano Pro, sem cobrança por uso. Você analisa quantas vezes quiser." },
  { q: "E se eu quiser cancelar?", a: "Cancela a qualquer momento, sem multa. Seus dados ficam disponíveis pra exportação por 90 dias após o cancelamento. Sem fidelidade, sem letra miúda." },
  { q: "Meus dados estão seguros?", a: "Sim. Banco com backup automático diário, criptografia em trânsito e em repouso, e conformidade com a LGPD. Você é dono dos seus dados e pode exportar tudo a qualquer momento." },
];

const chartBars = [35, 52, 48, 67, 55, 72, 68, 85, 78, 92, 88, 95, 82, 98, 90];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden relative" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif', fontFeatureSettings: '"ss01", "cv11"' }}>
      {/* Gradient mesh ambient */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-52 left-1/2 -translate-x-1/2 w-[1400px] h-[900px] rounded-full blur-[60px]" style={{ background: 'radial-gradient(ellipse at center, rgba(0,214,143,0.18) 0%, rgba(0,214,143,0.05) 35%, transparent 70%)' }} />
        <div className="absolute top-[300px] -right-52 w-[900px] h-[900px] rounded-full blur-[80px]" style={{ background: 'radial-gradient(circle at center, rgba(124,92,255,0.20) 0%, rgba(124,92,255,0.05) 40%, transparent 70%)' }} />
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '64px 64px', maskImage: 'radial-gradient(ellipse at center top, rgba(0,0,0,0.8), transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center top, rgba(0,0,0,0.8), transparent 70%)' }} />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b backdrop-blur-xl" style={{ background: 'rgba(0,0,0,0.6)', borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold text-lg tracking-tight">
            <span className="w-6 h-6 rounded-md relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #00d68f, #00ff9d)', boxShadow: '0 0 20px rgba(0,214,143,0.4)' }}>
              <span className="absolute inset-0" style={{ background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.4))' }} />
            </span>
            Ditt
          </div>
          <div className="hidden md:flex items-center gap-1 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <a href="#features" className="px-3.5 py-2 hover:text-white transition-colors">Recursos</a>
            <a href="#showcase" className="px-3.5 py-2 hover:text-white transition-colors">Como funciona</a>
            <a href="#pricing" className="px-3.5 py-2 hover:text-white transition-colors">Preços</a>
            <a href="#faq" className="px-3.5 py-2 hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">Entrar</Button>
            </Link>
            <Link to="/cadastro">
              <Button size="sm" className="text-black font-semibold gap-1.5 shadow-lg" style={{ background: 'linear-gradient(180deg, #00d68f, #00b878)', boxShadow: '0 1px 0 rgba(255,255,255,0.3) inset, 0 6px 20px -8px rgba(0,214,143,0.6)' }}>
                Começar grátis <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-20 pb-16 md:pt-32 md:pb-24 px-6 text-center">
        <div className="max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 pl-1.5 rounded-full border backdrop-blur-sm mb-8" style={{ borderColor: 'rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.03)', animation: 'fadeUp 0.7s ease both' }}>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider" style={{ background: 'linear-gradient(135deg, rgba(0,214,143,0.2), rgba(0,214,143,0.05))', border: '1px solid rgba(0,214,143,0.3)', color: '#00d68f' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00d68f', boxShadow: '0 0 8px #00d68f' }} />
              Novo
            </span>
            <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Fila IA · Atribuição por serviço · Painel TV ao vivo
            </span>
          </div>

          <h1 className="font-extrabold tracking-[-0.04em] leading-[0.95] mb-6" style={{ fontSize: 'clamp(40px, 7vw, 84px)', animation: 'fadeUp 0.8s 0.1s ease both' }}>
            O ERP que sua<br />
            <span className="inline-block bg-clip-text text-transparent" style={{ background: 'linear-gradient(120deg, #fff 0%, #fff 30%, #00d68f 55%, #00ff9d 75%, #fff 100%)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'shimmer 6s linear infinite' }}>
              assistência merecia.
            </span>
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-9 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', animation: 'fadeUp 0.9s 0.2s ease both' }}>
            Multi-técnico por serviço, IA priorizando a fila, portal do cliente, painel TV ao vivo e financeiro completo numa só plataforma. <strong className="text-white font-medium">Feito por quem entende do balcão.</strong>
          </p>

          <div className="flex flex-wrap gap-3 justify-center" style={{ animation: 'fadeUp 1s 0.3s ease both' }}>
            <Link to="/cadastro">
              <Button size="lg" className="h-13 px-6 text-black font-semibold gap-2 shadow-xl" style={{ background: 'linear-gradient(180deg, #00d68f, #00b878)', boxShadow: '0 1px 0 rgba(255,255,255,0.3) inset, 0 6px 20px -8px rgba(0,214,143,0.6)' }}>
                Começar grátis 14 dias <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-13 px-6 gap-2 text-white backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.14)' }}>
              <Play className="h-4 w-4 fill-current" /> Ver demonstração de 2min
            </Button>
          </div>

          <div className="flex flex-wrap gap-5 justify-center mt-5 text-[12.5px]" style={{ color: 'rgba(255,255,255,0.40)', animation: 'fadeUp 1.1s 0.4s ease both' }}>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" style={{ color: '#00d68f' }} />Sem cartão de crédito</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" style={{ color: '#00d68f' }} />Migramos seus dados grátis</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" style={{ color: '#00d68f' }} />Cancele quando quiser</span>
          </div>
        </div>

        {/* Mock do dashboard */}
        <div className="relative max-w-6xl mx-auto px-6 mt-16" style={{ animation: 'fadeUp 1.2s 0.5s ease both' }}>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[80%] blur-[60px] pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(0,214,143,0.25), transparent 60%)' }} />
          <div className="relative rounded-2xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.14)', background: 'linear-gradient(180deg, #0c0f0d, #050706)', boxShadow: '0 60px 120px -40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05), 0 30px 60px -30px rgba(0,214,143,0.15)' }}>
            <div className="flex items-center gap-2 px-5 h-9 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.4)' }}>
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex-1 mx-16 h-6 rounded px-2.5 flex items-center text-[11px]" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.40)' }}>
                🔒 app.ditt.com.br/dashboard
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] min-h-[520px]">
              <div className="hidden md:block border-r p-3.5 px-2.5" style={{ background: 'rgba(0,0,0,0.4)', borderColor: 'rgba(255,255,255,0.08)' }}>
                {[
                  { label: 'Dashboard', active: true },
                  { label: 'Assistência', badge: 34 },
                  { label: 'Aparelhos' }, { label: 'Peças' }, { label: 'Financeiro' },
                  { label: 'Relatórios' }, { label: 'Painel TV' }, { label: 'Configurações' },
                ].map((item: any) => (
                  <div key={item.label} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] mb-0.5 ${item.active ? 'font-semibold' : ''}`} style={item.active ? { background: 'rgba(0,214,143,0.1)', color: '#00d68f' } : { color: 'rgba(255,255,255,0.55)' }}>
                    <span className="w-3.5 h-3.5 rounded-sm" style={{ background: item.active ? '#00d68f' : 'currentColor', opacity: item.active ? 1 : 0.5 }} />
                    {item.label}
                    {item.badge && <span className="ml-auto text-[9px] text-white px-1.5 py-px rounded-full font-bold" style={{ background: '#ff5a52' }}>{item.badge}</span>}
                  </div>
                ))}
              </div>
              <div className="p-5">
                <div className="text-lg font-bold tracking-tight mb-1">Dashboard</div>
                <div className="text-[11.5px] mb-4" style={{ color: 'rgba(255,255,255,0.40)' }}>Maio 2026 · atualizado há 2 minutos</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
                  {[
                    { lbl: 'Faturamento', val: 'R$ 142.380', delta: '↑ 18.4% vs mês ant.', featured: true },
                    { lbl: 'Lucro líquido', val: 'R$ 56.480', delta: '39.7% margem' },
                    { lbl: 'OS no mês', val: '847', delta: '↑ 12% concluídas' },
                    { lbl: 'Ticket médio', val: 'R$ 168', delta: '→ estável' },
                  ].map((kpi: any) => (
                    <div key={kpi.lbl} className="px-3.5 py-3 rounded-xl border tabular-nums" style={kpi.featured ? { background: 'linear-gradient(135deg, rgba(0,214,143,0.18), rgba(0,214,143,0.04))', borderColor: 'rgba(0,214,143,0.3)' } : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                      <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.40)' }}>{kpi.lbl}</div>
                      <div className="text-lg font-bold tracking-tight" style={kpi.featured ? { color: '#00ff9d', textShadow: '0 0 20px rgba(0,255,157,0.3)' } : {}}>{kpi.val}</div>
                      <div className="text-[10px] mt-1 font-semibold" style={{ color: kpi.featured ? 'rgba(255,255,255,0.85)' : '#00d68f' }}>{kpi.delta}</div>
                    </div>
                  ))}
                </div>
                <div className="h-32 rounded-xl border p-3.5 flex items-end gap-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
                  {chartBars.map((h, i) => (
                    <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, minHeight: '8px', background: 'linear-gradient(180deg, #00d68f, rgba(0,214,143,0.3))', animation: `barRise 1.2s ${i*40}ms ease both` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Strip */}
      <section className="py-16 px-6 text-center border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-[11.5px] uppercase tracking-[0.12em] font-semibold mb-6" style={{ color: 'rgba(255,255,255,0.40)' }}>A escolha de oficinas que querem crescer</div>
          <div className="flex items-center justify-center gap-12 flex-wrap text-base font-bold tracking-tight" style={{ color: 'rgba(255,255,255,0.55)', opacity: 0.5 }}>
            <span>⌬ Mais de 200 técnicos ativos</span>
            <span>✦ Disponível em todo o Brasil</span>
            <span>⬢ Atende oficinas, redes e franquias</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-6 relative border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-4 text-[13px] uppercase tracking-wider font-bold" style={{ color: '#00d68f' }}>
            <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, transparent, #00d68f)' }} /> Resultados que aparecem na conta <span className="h-px w-8" style={{ background: 'linear-gradient(90deg, #00d68f, transparent)' }} />
          </div>
          <h2 className="text-center font-bold tracking-tight leading-tight max-w-3xl mx-auto mb-12" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
            Sua oficina rodando<br />
            <em className="not-italic font-extrabold" style={{ color: '#00d68f' }}>como uma operação séria.</em>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-extrabold tracking-[-0.04em] leading-none tabular-nums bg-clip-text text-transparent" style={{ fontSize: 'clamp(40px, 5vw, 64px)', background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.5) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {s.value}
                </div>
                <div className="text-[13px] mt-2 font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-[12.5px] mt-9 max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.40)' }}>Indicadores típicos observados após 90 dias de uso da plataforma.</p>
        </div>
      </section>

      {/* Features - Bento Grid */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <Badge variant="outline" className="mb-4 text-[11.5px] uppercase tracking-wider font-bold" style={{ background: 'rgba(0,214,143,0.10)', borderColor: 'rgba(0,214,143,0.25)', color: '#00d68f' }}>Recursos</Badge>
          <h2 className="font-extrabold tracking-[-0.035em] leading-[1.05] mb-4 max-w-2xl" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
            Tudo conversa com tudo.<br />
            <span className="bg-clip-text text-transparent" style={{ background: 'linear-gradient(135deg, #00d68f, #33c4ff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Zero planilha do lado.</span>
          </h2>
          <p className="text-lg max-w-xl leading-relaxed mb-16" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Vendeu uma peça? O estoque baixa, a comissão é gerada, o lucro aparece no painel do sócio. Em tempo real, sem integração externa.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-6 auto-rows-[200px] gap-3.5">
            {/* HERO CARD */}
            <div className="md:col-span-4 md:row-span-2 rounded-3xl border overflow-hidden grid grid-rows-[auto_1fr] transition-all hover:-translate-y-0.5" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}>
              <div className="p-7">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold mb-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00d68f', boxShadow: '0 0 8px #00d68f' }} />
                  Inédito no mercado
                </div>
                <h3 className="text-2xl font-bold tracking-tight leading-tight mb-2.5">Atribuição por serviço,<br />não por OS inteira.</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Cada serviço (tela, bateria, placa) vai pro técnico certo, com prazo, comissão e status próprios. Mesma OS, vários técnicos trabalhando em paralelo.
                </p>
              </div>
              <div className="mx-7 mb-7 rounded-xl border p-4 space-y-1.5" style={{ borderColor: 'rgba(255,255,255,0.14)', background: 'rgba(0,0,0,0.4)' }}>
                {[
                  { av: 'M', avBg: 'linear-gradient(135deg, #7c5cff, #33c4ff)', label: 'TROCA DE TELA', tag: 'Em reparo', tagColor: 'primary' },
                  { av: 'J', avBg: 'linear-gradient(135deg, #00d68f, #33c4ff)', label: 'TROCA DE BATERIA', tag: 'Aguard. peça', tagColor: 'warn' },
                  { av: 'L', avBg: 'linear-gradient(135deg, #ffb020, #ff5a52)', label: 'REPARO PLACA-MÃE', tag: 'Atrasado 2d', tagColor: 'danger' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full text-[10px] font-bold text-white flex items-center justify-center shrink-0" style={{ background: row.avBg }}>{row.av}</span>
                    <span className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.10)' }} />
                    <span className="px-2 py-0.5 text-[9px] font-bold rounded-full" style={
                      row.tagColor === 'primary' ? { background: 'rgba(0,214,143,0.18)', color: '#00d68f', border: '1px solid rgba(0,214,143,0.3)' } :
                      row.tagColor === 'warn' ? { background: 'rgba(255,176,32,0.18)', color: '#ffb020', border: '1px solid rgba(255,176,32,0.3)' } :
                      { background: 'rgba(255,90,82,0.18)', color: '#ff5a52', border: '1px solid rgba(255,90,82,0.3)' }
                    }>{row.tag}</span>
                    <span className="h-2 w-12 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* AI CARD */}
            <div className="md:col-span-2 md:row-span-2 rounded-3xl border p-7 relative overflow-hidden flex flex-col" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'radial-gradient(circle at 30% 20%, rgba(124,92,255,0.15), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}>
              <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full blur-[40px]" style={{ background: 'radial-gradient(circle, rgba(124,92,255,0.5), rgba(124,92,255,0.1))' }} />
              <Sparkles className="absolute top-6 right-6 h-8 w-8" style={{ color: '#bea6ff' }} />
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold relative w-fit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#bea6ff', boxShadow: '0 0 8px #bea6ff' }} />
                Fila IA
              </div>
              <div className="mt-auto relative">
                <h3 className="text-xl font-bold tracking-tight leading-tight mb-2">A IA prioriza por prazo, valor e técnico livre.</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>Em 2 segundos sugere a melhor distribuição da fila. Você só aprova.</p>
              </div>
            </div>

            {[
              { dot: '#00d68f', tag: 'Estoque', title: 'Baixa peça ao usar. Alerta antes de faltar.' },
              { dot: '#33c4ff', tag: 'Portal do cliente', title: 'Seu cliente vê OS, garantia e fatura no celular.' },
              { dot: '#ffb020', tag: 'Painel TV', title: 'Telão na oficina mostra fila, prontas e meta do dia.' },
              { dot: '#ff5a52', tag: 'Financeiro', title: 'Fluxo, comissão, DRE e fecha mês em 1 clique.' },
            ].map((card) => (
              <div key={card.tag} className="md:col-span-2 rounded-3xl border p-7 flex flex-col justify-between transition-all hover:-translate-y-0.5" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold w-fit" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: card.dot, boxShadow: `0 0 8px ${card.dot}` }} />
                  {card.tag}
                </div>
                <h3 className="text-lg font-bold tracking-tight leading-tight mt-auto">{card.title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase Kanban */}
      <section id="showcase" className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20 items-center">
          <div>
            <Badge variant="outline" className="mb-4 text-[11.5px] uppercase tracking-wider font-bold" style={{ background: 'rgba(0,214,143,0.10)', borderColor: 'rgba(0,214,143,0.25)', color: '#00d68f' }}>Kanban inteligente</Badge>
            <h3 className="font-extrabold tracking-[-0.03em] leading-tight mb-4" style={{ fontSize: 'clamp(28px, 3.5vw, 40px)' }}>
              Veja a fila do dia.<br />
              <em className="not-italic bg-clip-text text-transparent" style={{ background: 'linear-gradient(135deg, #00d68f, #00ff9d)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Saiba quem está atrasado.</em>
            </h3>
            <p className="text-[17px] leading-relaxed mb-7" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Cada card mostra cliente, serviço, prazo e prioridade. Atrasados sobem pro topo. Parados há mais de 5 dias ganham faixa âmbar. Sem precisar perguntar pra ninguém.
            </p>
            <ul className="space-y-3.5">
              {[
                { strong: 'Ordenação por urgência', span: '· atrasados primeiro, depois prazo curto' },
                { strong: 'Faixa âmbar pra parados 5+ dias', span: '· você vê antes do cliente reclamar' },
                { strong: 'Atribuição com 1 toque', span: '· arrasta ou usa o menu' },
                { strong: 'Realtime entre dispositivos', span: '· atendimento, técnico e gestor sincronizados' },
              ].map((item, i) => (
                <li key={i} className="flex gap-3.5">
                  <span className="shrink-0 w-6 h-6 rounded-full text-[13px] font-bold flex items-center justify-center" style={{ background: 'rgba(0,214,143,0.15)', border: '1px solid rgba(0,214,143,0.4)', color: '#00d68f' }}>✓</span>
                  <span className="text-[15px] leading-snug">
                    <strong className="font-semibold">{item.strong}</strong>
                    <span style={{ color: 'rgba(255,255,255,0.55)' }}> {item.span}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border p-4 relative overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.14)', background: 'linear-gradient(180deg, #0a0d0c, #050706)', boxShadow: '0 30px 80px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)' }}>
            <div className="absolute -top-24 -right-24 w-72 h-72 blur-[50px]" style={{ background: 'radial-gradient(circle, rgba(0,214,143,0.20), transparent 60%)' }} />
            <div className="flex gap-2.5 relative">
              {[
                { dot: '#ffb020', name: 'Sem técnico', count: 16, cards: [
                  { client: 'Cliente #2841', model: 'iPhone 13 Pro Max', tag: 'Atrasado 6d', tagColor: 'danger', val: 'R$ 390' },
                  { client: 'Cliente #2839', model: 'iPhone 13', tag: 'Em análise', tagColor: 'warn', val: 'R$ 25' },
                  { client: 'Cliente #2837', model: 'iPhone 12', tag: 'Recebido', tagColor: 'primary', val: 'R$ 615' },
                ]},
                { dot: '#33c4ff', name: 'Técnico 1', count: 3, cards: [
                  { client: 'Cliente #2835', model: 'iPhone 15 Pro Max', tag: 'Em reparo', tagColor: 'primary', av: 'M' },
                  { client: 'Cliente #2828', model: 'iPhone 14', tag: 'Aguard. peça', tagColor: 'warn', av: 'M' },
                ]},
                { dot: '#00d68f', name: 'Concluído', count: 20, cards: [
                  { client: 'Cliente #2820', model: 'iPhone 14 Pro', tag: 'Pronto', tagColor: 'primary', val: 'R$ 440' },
                  { client: 'Cliente #2818', model: 'iPhone 11', tag: 'Pronto', tagColor: 'primary', val: 'R$ 150' },
                  { client: 'Cliente #2815', model: 'iPhone 12 Pro', tag: 'Pronto', tagColor: 'primary', val: 'R$ 250' },
                ]},
              ].map((col) => (
                <div key={col.name} className="flex-1 border rounded-xl p-2.5 min-h-[280px]" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-1.5 px-1.5 pb-2.5 text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: col.dot }} />
                    {col.name}
                    <span className="ml-auto text-[10px] px-1.5 py-px rounded-full text-white" style={{ background: 'rgba(255,255,255,0.08)' }}>{col.count}</span>
                  </div>
                  {col.cards.map((c: any, i) => (
                    <div key={i} className="border rounded-lg p-2.5 mb-1.5" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                      <div className="text-[11px] font-semibold mb-1">{c.client}</div>
                      <div className="text-[9.5px] mb-1.5" style={{ color: 'rgba(255,255,255,0.40)' }}>{c.model}</div>
                      <div className="flex items-center gap-1 text-[9px]">
                        <span className="px-1.5 py-0.5 rounded-full font-bold border" style={
                          c.tagColor === 'primary' ? { background: 'rgba(0,214,143,0.15)', color: '#00d68f', borderColor: 'rgba(0,214,143,0.25)' } :
                          c.tagColor === 'warn' ? { background: 'rgba(255,176,32,0.15)', color: '#ffb020', borderColor: 'rgba(255,176,32,0.25)' } :
                          { background: 'rgba(255,90,82,0.15)', color: '#ff5a52', borderColor: 'rgba(255,90,82,0.25)' }
                        }>{c.tag}</span>
                        {c.av ? (
                          <span className="ml-auto w-4 h-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c5cff, #33c4ff)' }}>{c.av}</span>
                        ) : (
                          <span className="ml-auto text-[10px] font-bold tabular-nums">{c.val}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Painel do Sócio */}
      <section className="py-24 px-6" style={{ background: 'linear-gradient(180deg, transparent, rgba(124,92,255,0.03), transparent)' }}>
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20 items-center">
          {/* Mock */}
          <div className="rounded-2xl border p-6 relative overflow-hidden order-2 md:order-1" style={{ borderColor: 'rgba(255,255,255,0.14)', background: 'linear-gradient(180deg, #0a0d0c, #050706)', boxShadow: '0 30px 80px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)' }}>
            <div className="absolute -top-24 -left-24 w-72 h-72 blur-[50px]" style={{ background: 'radial-gradient(circle, rgba(124,92,255,0.25), transparent 60%)' }} />
            <div className="flex items-center justify-between mb-4 relative">
              <h4 className="text-sm font-bold tracking-tight">Painel do Sócio · Maio 2026</h4>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border" style={{ background: 'rgba(0,214,143,0.15)', color: '#00d68f', borderColor: 'rgba(0,214,143,0.3)' }}>↑ 21.4%</span>
            </div>
            <div className="p-5 rounded-2xl border mb-3.5 relative" style={{ background: 'linear-gradient(135deg, rgba(0,214,143,0.15), rgba(0,214,143,0.03))', borderColor: 'rgba(0,214,143,0.25)' }}>
              <div className="text-[11px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>Você já tem · dia 28/31</div>
              <div className="text-4xl font-extrabold tracking-tight tabular-nums" style={{ color: '#00ff9d', textShadow: '0 0 30px rgba(0,255,157,0.3)' }}>R$ 18.840</div>
              <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>vs R$ 15.510 no mesmo período do mês anterior</div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 relative">
              {[
                { lbl: 'Faturamento', val: 'R$ 142.380', delta: '↑ 18.4%', up: true },
                { lbl: 'Custos', val: 'R$ 85.900', delta: '↑ 9.2%', up: false },
                { lbl: 'Lucro líq.', val: 'R$ 56.480', delta: '↑ 39.7%', up: true },
                { lbl: 'Reserva', val: 'R$ 8.540', delta: '6% sobre receita', neutral: true },
              ].map((cell: any) => (
                <div key={cell.lbl} className="p-3.5 rounded-xl border tabular-nums" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
                  <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>{cell.lbl}</div>
                  <div className="text-lg font-bold">{cell.val}</div>
                  <div className="text-[10px] mt-1" style={{ color: cell.neutral ? 'rgba(255,255,255,0.55)' : cell.up ? '#00d68f' : '#ff5a52' }}>{cell.delta}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="order-1 md:order-2">
            <Badge variant="outline" className="mb-4 text-[11.5px] uppercase tracking-wider font-bold" style={{ background: 'rgba(124,92,255,0.10)', borderColor: 'rgba(124,92,255,0.25)', color: '#bea6ff' }}>Painel do Sócio</Badge>
            <h3 className="font-extrabold tracking-[-0.03em] leading-tight mb-4" style={{ fontSize: 'clamp(28px, 3.5vw, 40px)' }}>
              O painel que <em className="not-italic bg-clip-text text-transparent" style={{ background: 'linear-gradient(135deg, #00d68f, #00ff9d)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>nenhum</em><br />concorrente faz.
            </h3>
            <p className="text-[17px] leading-relaxed mb-7" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Lucro líquido em tempo real. Quanto cada sócio pode retirar. Reserva de emergência. Fechamento mensal com aprovação. Você sabe na hora se o mês está bom ou não.
            </p>
            <ul className="space-y-3.5">
              {[
                { strong: 'Lucro distribuível por sócio', span: '· considera retiradas do mês' },
                { strong: 'Caixa operacional + reserva', span: '· runway em meses' },
                { strong: 'Fechamento mensal', span: '· trava lançamentos retroativos' },
                { strong: 'Comparativo mês-a-mês', span: '· vs mesmo período do anterior' },
              ].map((item, i) => (
                <li key={i} className="flex gap-3.5">
                  <span className="shrink-0 w-6 h-6 rounded-full text-[13px] font-bold flex items-center justify-center" style={{ background: 'rgba(0,214,143,0.15)', border: '1px solid rgba(0,214,143,0.4)', color: '#00d68f' }}>✓</span>
                  <span className="text-[15px] leading-snug">
                    <strong className="font-semibold">{item.strong}</strong>
                    <span style={{ color: 'rgba(255,255,255,0.55)' }}> {item.span}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-[11.5px] uppercase tracking-wider font-bold" style={{ background: 'rgba(0,214,143,0.10)', borderColor: 'rgba(0,214,143,0.25)', color: '#00d68f' }}>Preços</Badge>
            <h2 className="font-extrabold tracking-[-0.035em] leading-[1.05] mb-4" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
              Pague pelo plano.<br />
              <span className="bg-clip-text text-transparent" style={{ background: 'linear-gradient(135deg, #00d68f, #33c4ff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Não pela OS.</span>
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.55)' }}>Faça 100 ou 10.000 OSs/mês — a fatura é a mesma. Sem letra miúda, sem surpresa.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Starter */}
            <div className="rounded-3xl border p-8 flex flex-col" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.005))' }}>
              <div className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>Starter</div>
              <div className="text-5xl font-extrabold tracking-tight tabular-nums leading-none">R$ 97<small className="text-sm font-medium ml-1" style={{ color: 'rgba(255,255,255,0.55)' }}>/mês</small></div>
              <p className="text-xs mt-2 mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>Pra oficina de até 2 pessoas. 14 dias grátis, sem cartão.</p>
              <Link to="/cadastro" className="block">
                <Button variant="outline" className="w-full h-11 text-white" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.14)' }}>Começar grátis</Button>
              </Link>
              <ul className="mt-7 space-y-3 flex-1">
                {['2 usuários', '200 OS/mês', 'Estoque + financeiro', 'Portal do cliente', 'Suporte por email'].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <span className="w-4 h-4 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0" style={{ background: 'rgba(0,214,143,0.15)', color: '#00d68f' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="rounded-3xl border-2 p-8 flex flex-col relative" style={{ borderColor: 'rgba(0,214,143,0.3)', background: 'linear-gradient(180deg, rgba(0,214,143,0.06), rgba(0,214,143,0.01))', boxShadow: '0 30px 60px -30px rgba(0,214,143,0.3), 0 0 0 1px rgba(0,214,143,0.2)' }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider text-black" style={{ background: 'linear-gradient(135deg, #00d68f, #00ff9d)', boxShadow: '0 8px 24px -8px rgba(0,214,143,0.6)' }}>
                ★ Mais escolhido
              </div>
              <div className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: '#00d68f' }}>Pro</div>
              <div className="text-5xl font-extrabold tracking-tight tabular-nums leading-none">R$ 197<small className="text-sm font-medium ml-1" style={{ color: 'rgba(255,255,255,0.55)' }}>/mês</small></div>
              <p className="text-xs mt-2 mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>Operação completa pra crescer sem trava.</p>
              <Link to="/cadastro" className="block">
                <Button className="w-full h-11 text-black font-semibold gap-1.5" style={{ background: 'linear-gradient(180deg, #00d68f, #00b878)', boxShadow: '0 1px 0 rgba(255,255,255,0.3) inset, 0 6px 20px -8px rgba(0,214,143,0.6)' }}>
                  Começar grátis <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <ul className="mt-7 space-y-3 flex-1 text-sm">
                {[
                  ['Usuários ilimitados', false],
                  ['OS ilimitadas', false],
                  ['Fila IA', true],
                  ['Painel TV ao vivo', true],
                  ['Painel do Sócio', true],
                  ['Portal B2B + cashback', false],
                  ['Migração de dados grátis', false],
                  ['Suporte prioritário', false],
                ].map(([label, bold]) => (
                  <li key={label as string} className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0" style={{ background: 'rgba(0,214,143,0.15)', color: '#00d68f' }}>✓</span>
                    {bold ? <strong>{label as string}</strong> : (label as string)}
                  </li>
                ))}
              </ul>
            </div>

            {/* Rede */}
            <div className="rounded-3xl border p-8 flex flex-col" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.005))' }}>
              <div className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>Rede</div>
              <div className="text-3xl font-extrabold tracking-tight leading-none">Conversa</div>
              <p className="text-xs mt-2 mb-6" style={{ color: 'rgba(255,255,255,0.55)' }}>Mais de 1 unidade, franquia ou integração via API.</p>
              <a href={`mailto:${APP_CONFIG.supportEmail}?subject=Plano%20Rede`} className="block">
                <Button variant="outline" className="w-full h-11 gap-1.5 text-white" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.14)' }}>
                  <MessageCircle className="h-3.5 w-3.5" /> Falar com vendas
                </Button>
              </a>
              <ul className="mt-7 space-y-3 flex-1">
                {['Multi-unidade', 'API dedicada', 'SLA garantido', 'Onboarding presencial', 'Customizações'].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <span className="w-4 h-4 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0" style={{ background: 'rgba(0,214,143,0.15)', color: '#00d68f' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 text-[11.5px] uppercase tracking-wider font-bold" style={{ background: 'rgba(0,214,143,0.10)', borderColor: 'rgba(0,214,143,0.25)', color: '#00d68f' }}>Perguntas</Badge>
            <h2 className="font-extrabold tracking-[-0.035em] leading-[1.05]" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>Tudo o que perguntam.</h2>
          </div>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <details key={i} open={i === 0} className="group rounded-xl border overflow-hidden transition-all hover:border-white/20" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                <summary className="flex items-center justify-between px-5 py-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <h3 className="font-semibold text-[15px]">{faq.q}</h3>
                  <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90 shrink-0" style={{ color: 'rgba(255,255,255,0.55)' }} />
                </summary>
                <p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-28 px-6 text-center relative overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] blur-[80px] pointer-events-none -z-10" style={{ background: 'radial-gradient(circle, rgba(0,214,143,0.15), transparent 60%)' }} />
        <div className="max-w-3xl mx-auto">
          <h2 className="font-extrabold tracking-[-0.04em] leading-[1.0] mb-5" style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}>
            Tira sua oficina<br />
            <span className="bg-clip-text text-transparent" style={{ background: 'linear-gradient(135deg, #fff, #00ff9d)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>do improviso.</span>
          </h2>
          <p className="text-lg mb-9 max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.55)' }}>Comece grátis hoje. Em 1 hora você está rodando.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/cadastro">
              <Button size="lg" className="h-13 px-6 text-black font-semibold gap-2" style={{ background: 'linear-gradient(180deg, #00d68f, #00b878)', boxShadow: '0 1px 0 rgba(255,255,255,0.3) inset, 0 6px 20px -8px rgba(0,214,143,0.6)' }}>
                Começar grátis 14 dias <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="https://wa.me/5511999999999?text=Quero%20conhecer%20o%20Ditt" target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="h-13 px-6 gap-2 text-white backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.14)' }}>
                <MessageCircle className="h-4 w-4" /> Falar com vendas
              </Button>
            </a>
          </div>
          <p className="text-[12.5px] mt-5" style={{ color: 'rgba(255,255,255,0.40)' }}>Sem cartão · Migração grátis · Cancele quando quiser</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.4)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr] gap-12 mb-9">
            <div>
              <div className="flex items-center gap-2 font-extrabold text-lg tracking-tight mb-3">
                <span className="w-6 h-6 rounded-md relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #00d68f, #00ff9d)', boxShadow: '0 0 20px rgba(0,214,143,0.4)' }} />
                Ditt
              </div>
              <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>O ERP que sua assistência merecia. Multi-técnico, IA, portal do cliente, painel TV. Feito por quem entende do balcão.</p>
            </div>
            {[
              { title: 'Produto', items: [['Recursos', '#features'], ['Como funciona', '#showcase'], ['Preços', '#pricing'], ['FAQ', '#faq']] },
              { title: 'Empresa', items: [['Sobre', '#'], ['Blog', '#'], ['Contato', '#'], ['Carreiras', '#']] },
              { title: 'Legal', items: [['Termos de uso', '#'], ['Privacidade', '#'], ['Cookies', '#'], ['LGPD', '#']] },
            ].map((col) => (
              <div key={col.title}>
                <h5 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>{col.title}</h5>
                {col.items.map(([label, href]) => (
                  <a key={label} href={href} className="block text-[13.5px] py-1.5 hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</a>
                ))}
              </div>
            ))}
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center pt-6 border-t gap-3 text-xs" style={{ borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.40)' }}>
            <div>© 2026 {APP_CONFIG.name}. Todos os direitos reservados.</div>
            <div>Feito em SP · Brasil</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
