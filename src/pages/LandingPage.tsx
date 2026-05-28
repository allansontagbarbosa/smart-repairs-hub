import { Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DittLogo } from "@/components/DittLogo";
import { APP_CONFIG } from "@/config/app";
import {
  Wrench, Package, DollarSign, BrainCircuit, Smartphone, BarChart3,
  Check, ArrowRight, Search, Sparkles, Zap, Shield, Users, Clock,
  TrendingUp, MessageCircle, ChevronRight, Play, Bell, Tv,
} from "lucide-react";

const stats = [
  { value: "1.494", label: "Ordens gerenciadas" },
  { value: "1.435", label: "Reparos concluídos" },
  { value: "1.454", label: "Aparelhos rastreados" },
  { value: "96%", label: "Taxa de entrega no prazo" },
];

const features = [
  {
    icon: Wrench,
    title: "Gestão multi-técnico por serviço",
    desc: "Atribua cada serviço (tela, bateria, placa) a um técnico diferente dentro da mesma OS. Comissão calculada por serviço, não por OS.",
    accent: "from-blue-500/20 to-cyan-500/20",
  },
  {
    icon: BrainCircuit,
    title: "Fila IA",
    desc: "A IA prioriza ordens analisando prazo, valor e técnico disponível. Sugere a melhor distribuição automaticamente.",
    accent: "from-violet-500/20 to-purple-500/20",
  },
  {
    icon: Package,
    title: "Estoque que se controla sozinho",
    desc: "Cada peça baixa do estoque ao ser usada. Alerta automático quando bate estoque mínimo. Compras com tracking de entrada.",
    accent: "from-amber-500/20 to-orange-500/20",
  },
  {
    icon: DollarSign,
    title: "Financeiro 360°",
    desc: "Fluxo de caixa, recebimentos, comissões, DRE, painel do sócio com retiradas e lucro distribuível. Fecha o mês em 1 clique.",
    accent: "from-emerald-500/20 to-teal-500/20",
  },
  {
    icon: Smartphone,
    title: "Portal do cliente B2B",
    desc: "Seus lojistas acompanham OSs, garantias e faturas pelo navegador. Cashback, extrato e PDF de fatura inclusos.",
    accent: "from-pink-500/20 to-rose-500/20",
  },
  {
    icon: Tv,
    title: "Painel TV em tempo real",
    desc: "Configure displays na oficina mostrando fila de serviço, OSs prontas e meta do dia. Atualiza ao vivo via WebSocket.",
    accent: "from-indigo-500/20 to-blue-500/20",
  },
];

const differentiators = [
  { icon: Zap, title: "Granularidade por serviço", desc: "Outros sistemas atribuem a OS inteira. Aqui cada serviço (tela + bateria + placa) tem seu próprio técnico, prazo e comissão." },
  { icon: TrendingUp, title: "Painel do Sócio", desc: "Lucro líquido em tempo real, retiradas, reserva de emergência, fechamento mensal com aprovação. Único no mercado." },
  { icon: Shield, title: "Sem cobrança por OS", desc: "Plano fixo. Faça 10 ou 10.000 OSs/mês. Sem surpresa na fatura." },
];

const faqs = [
  { q: "Quanto tempo leva pra migrar meu sistema atual?", a: "Importação assistida em até 48h. Trazemos clientes, aparelhos e OSs abertas do seu sistema atual sem você perder histórico." },
  { q: "Funciona em quantos aparelhos ao mesmo tempo?", a: "Ilimitado. Você usa no celular, técnico no tablet, atendimento no PC, painel TV na parede. Tudo sincronizado em tempo real." },
  { q: "E se eu quiser cancelar?", a: "Cancela a qualquer momento, sem multa. Seus dados ficam disponíveis pra exportação por 90 dias." },
  { q: "Os clientes precisam pagar pra usar o portal?", a: "Não. O portal é grátis pra eles. Você inclui o acesso quando cadastra cada cliente B2B." },
];

const whatsappLink = "https://wa.me/5500000000000?text=" + encodeURIComponent("Quero conhecer o Ditt");

export default function LandingPage() {
  const [statsInView, setStatsInView] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setStatsInView(true),
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      {/* Ambient gradient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/20 blur-3xl opacity-50" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-violet-500/15 blur-3xl opacity-40" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/"><DittLogo size="md" /></Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Recursos</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Preços</a>
            <a href="#faq" className="hover:text-foreground transition-colors">Perguntas</a>
            <Link to="/consultar" className="hover:text-foreground transition-colors">Consultar OS</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild><Link to="/login">Entrar</Link></Button>
            <Button size="sm" asChild>
              <Link to="/cadastro">Começar grátis <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-20 pb-24 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <Badge variant="outline" className="mb-6 gap-1.5 border-primary/30 bg-primary/5 text-primary">
            <Sparkles className="h-3 w-3" />
            Sistema com IA pra assistência técnica
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.05] mb-6">
            Sua assistência
            <br />
            <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
              roda no automático.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Multi-técnico por serviço, IA priorizando a fila, portal do cliente, painel TV ao vivo e financeiro completo.
            <br className="hidden md:block" />
            Feito por quem entende de oficina.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
            <Button size="lg" asChild className="h-12 px-6 text-base">
              <Link to="/cadastro">Começar grátis por 14 dias <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-12 px-6 text-base">
              <Link to="/consultar"><Search className="mr-1 h-4 w-4" /> Consultar minha OS</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Sem cartão de crédito · Cancele quando quiser · Importação grátis dos seus dados</p>

          {/* Mock dashboard preview */}
          <div className="relative mt-16 max-w-5xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-violet-500/20 to-cyan-500/20 blur-2xl rounded-3xl" />
            <div className="relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
                  <div className="w-3 h-3 rounded-full bg-green-400/70" />
                </div>
                <span className="text-xs text-muted-foreground">ditt.com.br/dashboard</span>
                <div className="w-12" />
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    "from-primary/30 to-primary/10",
                    "from-violet-500/30 to-violet-500/10",
                    "from-amber-500/30 to-amber-500/10",
                    "from-emerald-500/30 to-emerald-500/10",
                  ].map((g, i) => (
                    <div key={i} className={`h-20 rounded-lg bg-gradient-to-br ${g} border border-border/40`} />
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 h-48 rounded-lg bg-gradient-to-br from-primary/15 to-violet-500/10 border border-border/40 p-4 flex flex-col justify-end gap-1">
                    {[60, 75, 45, 90, 70, 85].map((h, i) => (
                      <div key={i} className="h-1 rounded-full bg-primary/40" style={{ width: `${h}%` }} />
                    ))}
                  </div>
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-10 rounded-md bg-muted/50 border border-border/40" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 border-y border-border/40 bg-card/30 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-sm uppercase tracking-widest text-muted-foreground mb-10">Em produção, agora</p>
          <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`text-center transition-all duration-700 ${statsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
                  {s.value}
                </div>
                <p className="text-sm text-muted-foreground mt-2">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Recursos</Badge>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">Tudo conversa com tudo.</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Sem integração externa, sem planilha do lado. Vendeu uma peça? O estoque baixa, a comissão é gerada, o lucro aparece no painel.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl p-6 hover:border-border hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${f.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="py-24 px-6 bg-card/30 backdrop-blur-xl border-y border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Por que Ditt</Badge>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter">3 coisas que ninguém mais faz.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {differentiators.map((d) => (
              <div key={d.title} className="p-8 rounded-2xl border border-border/40 bg-background/50">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center mb-5 shadow-lg shadow-primary/20">
                  <d.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{d.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Preços</Badge>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">Simples. Sem pegadinha.</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Sem cobrança por OS. Sem limite de aparelhos no estoque. Pague só pelo plano.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {/* Starter */}
            <div className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl p-8">
              <div className="mb-6">
                <h3 className="text-xl font-semibold">Starter</h3>
                <p className="text-sm text-muted-foreground mt-1">Pra começar sem medo</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tighter">R$ 97</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">14 dias grátis · sem cartão</p>
              </div>
              <Button variant="outline" className="w-full mb-6" asChild><Link to="/cadastro">Começar grátis</Link></Button>
              <ul className="space-y-3 text-sm">
                {["2 usuários", "200 OS/mês", "Estoque básico", "Suporte por email"].map((i) => (
                  <li key={i} className="flex items-start gap-2"><Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /><span>{i}</span></li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="relative rounded-2xl border-2 border-primary bg-card/50 backdrop-blur-xl p-8 md:scale-105 shadow-2xl shadow-primary/20">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground shadow-lg">Mais escolhido</Badge>
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-semibold">Pro</h3>
                <p className="text-sm text-muted-foreground mt-1">Operação completa</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tighter">R$ 197</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">14 dias grátis · sem cartão</p>
              </div>
              <Button className="w-full mb-6" asChild>
                <Link to="/cadastro">Começar grátis <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <ul className="space-y-3 text-sm">
                {["Usuários ilimitados", "OS ilimitadas", "Fila IA", "Portal do cliente B2B", "Painel TV ao vivo", "Painel do Sócio", "Suporte prioritário"].map((i) => (
                  <li key={i} className="flex items-start gap-2"><Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /><span>{i}</span></li>
                ))}
              </ul>
            </div>

            {/* Enterprise */}
            <div className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl p-8">
              <div className="mb-6">
                <h3 className="text-xl font-semibold">Enterprise</h3>
                <p className="text-sm text-muted-foreground mt-1">Rede de oficinas / multi-loja</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tighter">Sob medida</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Plano personalizado</p>
              </div>
              <a href={`mailto:${APP_CONFIG.supportEmail}?subject=Plano%20Enterprise`} className="block">
                <Button variant="outline" className="w-full mb-6">
                  <MessageCircle className="mr-1 h-4 w-4" /> Falar com vendas
                </Button>
              </a>
              <ul className="space-y-3 text-sm">
                {["Multi-unidade", "API dedicada", "SLA garantido", "Gestor de conta", "Treinamento presencial"].map((i) => (
                  <li key={i} className="flex items-start gap-2"><Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /><span>{i}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 bg-card/30 backdrop-blur-xl border-y border-border/40">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">Perguntas</Badge>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter">Tudo o que perguntam.</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details key={faq.q} className="group rounded-xl border border-border/40 bg-background/50 p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <h3 className="font-medium pr-4">{faq.q}</h3>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-4 text-muted-foreground leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 -z-10 flex items-center justify-center">
          <div className="w-[800px] h-[400px] bg-gradient-to-r from-primary/30 via-violet-500/20 to-cyan-500/20 blur-3xl rounded-full" />
        </div>
        <div className="max-w-3xl mx-auto text-center">
          <Sparkles className="h-10 w-10 text-primary mx-auto mb-6" />
          <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6">Pronto pra automatizar sua oficina?</h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Suba seus dados, treine sua equipe em 1 hora e comece a economizar tempo no mesmo dia.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
            <Button size="lg" asChild className="h-12 px-6 text-base">
              <Link to="/cadastro">Criar conta grátis <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-12 px-6 text-base">
              <a href={whatsappLink} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-1 h-4 w-4" /> Falar com vendas
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">14 dias grátis · Sem cartão · Cancele a qualquer hora</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <DittLogo size="sm" />
              <span>© {new Date().getFullYear()} {APP_CONFIG.name}</span>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <a href="#features" className="hover:text-foreground">Recursos</a>
              <a href="#pricing" className="hover:text-foreground">Preços</a>
              <a href="#faq" className="hover:text-foreground">FAQ</a>
              <Link to="/consultar" className="hover:text-foreground">Consultar OS</Link>
              <Link to="/login" className="hover:text-foreground">Entrar</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
