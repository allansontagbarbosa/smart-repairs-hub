import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MobileFixLogo } from "@/components/MobileFixLogo";
import {
  Wrench, Package, DollarSign, BrainCircuit, Globe, BarChart3,
  Check, Star, ArrowRight, Smartphone
} from "lucide-react";

const features = [
  { icon: Wrench, title: "Ordens de Serviço", desc: "Controle completo do fluxo de reparo, do recebimento à entrega." },
  { icon: Package, title: "Controle de Estoque", desc: "Gestão de peças com alertas de reposição e entradas em lote." },
  { icon: DollarSign, title: "Financeiro", desc: "Contas a pagar, recebimentos, comissões e DRE automático." },
  { icon: BrainCircuit, title: "Fila IA", desc: "Priorização inteligente das ordens de serviço com IA." },
  { icon: Globe, title: "Portal do Cliente", desc: "Seus clientes acompanham o status do reparo em tempo real." },
  { icon: BarChart3, title: "Relatórios", desc: "Indicadores de desempenho, defeitos e produtividade de técnicos." },
];

const plans = [
  {
    name: "Básico",
    price: "R$ 97",
    period: "/mês",
    trial: "14 dias grátis",
    features: ["Até 2 usuários", "200 OS/mês", "Controle de estoque", "Financeiro básico", "Suporte por email"],
    cta: "Começar grátis",
    highlighted: false,
  },
  {
    name: "Profissional",
    price: "R$ 197",
    period: "/mês",
    trial: "14 dias grátis",
    features: ["Usuários ilimitados", "OS ilimitadas", "Fila IA", "Portal do cliente", "Relatórios avançados", "Suporte prioritário"],
    cta: "Começar grátis",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Consultar",
    period: "",
    trial: "Personalizado",
    features: ["Multi-unidade", "API dedicada", "Gestor de conta", "SLA garantido", "Treinamento presencial", "Customizações"],
    cta: "Falar com vendas",
    highlighted: false,
  },
];

const testimonials = [
  { name: "Carlos Silva", company: "TechFix Assistência", text: "Reduzimos o tempo de atendimento em 40% depois que adotamos o MobileFix. A Fila IA é genial.", stars: 5 },
  { name: "Ana Oliveira", company: "CelularTop Reparos", text: "O portal do cliente economiza dezenas de ligações por dia. Nossos clientes adoram acompanhar online.", stars: 5 },
  { name: "Roberto Santos", company: "Master Cell", text: "Finalmente um sistema feito para assistência técnica. Simples, rápido e com tudo que precisamos.", stars: 5 },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <MobileFixLogo size="sm" />
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/cadastro">
              <Button size="sm">Criar conta</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 md:py-32 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge variant="secondary" className="mb-4">
            <Smartphone className="h-3 w-3 mr-1" /> Sistema para assistência técnica
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
            Gerencie sua assistência técnica com <span className="text-primary">inteligência</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Ordens de serviço, estoque, financeiro e portal do cliente em uma única plataforma.
            Comece em minutos, sem complicação.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Link to="/cadastro">
              <Button size="lg" className="w-full sm:w-auto text-base px-8">
                Começar grátis por 14 dias <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8">
                Ver demonstração
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">Sem cartão de crédito • Cancele quando quiser</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Tudo que sua assistência precisa</h2>
            <p className="text-muted-foreground mt-2">Ferramentas profissionais integradas em um só lugar.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Planos simples e transparentes</h2>
            <p className="text-muted-foreground mt-2">Escolha o plano ideal para o tamanho da sua operação.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative flex flex-col ${plan.highlighted ? "border-primary shadow-lg ring-1 ring-primary/20" : "border"}`}
              >
                {plan.highlighted && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">★ Recomendado</Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <CardDescription>{plan.trial}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-2.5 flex-1">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/cadastro" className="mt-6">
                    <Button className="w-full" variant={plan.highlighted ? "default" : "outline"}>
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Quem usa, recomenda</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} className="border-0 shadow-sm">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex gap-0.5">
                    {Array.from({ length: t.stars }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground italic">"{t.text}"</p>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.company}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold text-foreground">Comece hoje, sem cartão de crédito</h2>
          <p className="text-muted-foreground">
            Crie sua conta em segundos e tenha 14 dias para testar todas as funcionalidades.
          </p>
          <Link to="/cadastro">
            <Button size="lg" className="text-base px-8">
              Criar minha conta grátis <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <MobileFixLogo size="sm" />
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-foreground transition-colors">Política de Privacidade</a>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} MobileFix. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
