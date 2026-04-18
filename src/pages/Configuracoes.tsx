import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Loader2, Building2, Package, Wrench, Truck, Users, DollarSign, Boxes,
  ListChecks, Bell, FileText, Search, ShieldCheck, Tag, FileDown, Settings,
  ChevronRight, Menu, X, MapPin, Palette, Globe, AlertTriangle, Store, Smartphone,
} from "lucide-react";
import { useConfiguracoes } from "@/hooks/useConfiguracoes";
import { ConfigGeralTab } from "@/components/configuracoes/ConfigGeralTab";
import { ConfigProdutosTab } from "@/components/configuracoes/ConfigProdutosTab";
import { ConfigServicosTab } from "@/components/configuracoes/ConfigServicosTab";
import { ConfigFornecedoresTab } from "@/components/configuracoes/ConfigFornecedoresTab";

import { ConfigTecnicosTab } from "@/components/configuracoes/ConfigTecnicosTab";
import { ConfigLojistasTab } from "@/components/configuracoes/ConfigLojistasTab";
import { ConfigFinanceiroTab } from "@/components/configuracoes/ConfigFinanceiroTab";
import { ConfigEstoqueTab } from "@/components/configuracoes/ConfigEstoqueTab";
import { ConfigStatusTab } from "@/components/configuracoes/ConfigStatusTab";
import { ConfigNotificacoesTab } from "@/components/configuracoes/ConfigNotificacoesTab";
import { ConfigDocumentosTab } from "@/components/configuracoes/ConfigDocumentosTab";
import { ConfigUsuariosTab } from "@/components/configuracoes/ConfigUsuariosTab";
import { ConfigListaPrecosTab } from "@/components/configuracoes/ConfigListaPrecosTab";
import { ConfigExportacaoTab } from "@/components/configuracoes/ConfigExportacaoTab";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

// Grouped sections
const groups = [
  {
    label: "Geral",
    items: [
      { id: "geral", label: "Dados da Empresa", icon: Building2, keywords: ["empresa", "nome", "logo", "cnpj", "dados"] },
    ],
  },
  {
    label: "Usuários",
    items: [
      { id: "usuarios", label: "Usuários e Acessos", icon: ShieldCheck, keywords: ["usuario", "acesso", "perfil", "permissao", "login"] },
    ],
  },
  {
    label: "Cadastros Base",
    items: [
      { id: "pecas", label: "Peças", icon: Package, keywords: ["peca", "peça", "produto", "sku", "catalogo", "item", "estoque"] },
      { id: "servicos", label: "Serviços", icon: Wrench, keywords: ["servico", "tipo", "comissao", "defeito", "problema", "categoria"] },
      { id: "precos", label: "Lista de Preços", icon: Tag, keywords: ["preco", "tabela", "lista", "valor"] },
    ],
  },
  {
    label: "Operacional",
    items: [
      { id: "tecnicos", label: "Técnicos", icon: Users, keywords: ["tecnico", "funcionario", "comissao", "equipe"] },
      { id: "fornecedores", label: "Fornecedores", icon: Truck, keywords: ["fornecedor", "parceiro", "compra"] },
      { id: "lojistas", label: "Lojistas B2B", icon: Store, keywords: ["lojista", "parceiro", "b2b", "loja"] },
      { id: "status", label: "Status e Etapas", icon: ListChecks, keywords: ["status", "etapa", "fluxo", "prioridade"] },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { id: "financeiro", label: "Financeiro", icon: DollarSign, keywords: ["financeiro", "categoria", "centro", "custo", "pagamento"] },
    ],
  },
  {
    label: "Cadastros Base",
    items: [
      { id: "estoque", label: "Aparelhos", icon: Smartphone, keywords: ["aparelho", "marca", "modelo", "cor", "capacidade", "estoque"] },
    ],
  },
  {
    label: "Documentos",
    items: [
      { id: "documentos", label: "Modelos de Documento", icon: FileText, keywords: ["documento", "laudo", "recibo", "orcamento", "ordem", "template"] },
    ],
  },
  {
    label: "Automações",
    items: [
      { id: "notificacoes", label: "Notificações", icon: Bell, keywords: ["notificacao", "mensagem", "whatsapp", "template", "automacao"] },
    ],
  },
  {
    label: "Avançado",
    items: [
      { id: "exportacao", label: "Importação / Exportação", icon: FileDown, keywords: ["exportar", "importar", "csv", "planilha"] },
    ],
  },
];

const allItems = groups.flatMap((g) => g.items);

export default function Configuracoes() {
  const { aba } = useParams();
  const data = useConfiguracoes();
  // Compat: a aba antiga "produtos" virou "pecas" — redireciona transparentemente
  const normalizedAba = aba === "produtos" ? "pecas" : aba;
  const [active, setActive] = useState(normalizedAba || "geral");
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (normalizedAba && allItems.some((i) => i.id === normalizedAba)) {
      setActive(normalizedAba);
    }
  }, [normalizedAba]);

  const activeItem = allItems.find((i) => i.id === active);

  // Filter groups by search
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groups;
    const q = searchTerm.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.label.toLowerCase().includes(q) ||
            i.keywords.some((k) => k.includes(q)) ||
            g.label.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [searchTerm]);

  // Auto-navigate to first match when searching
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (value.trim()) {
      const q = value.toLowerCase();
      const match = allItems.find(
        (i) => i.label.toLowerCase().includes(q) || i.keywords.some((k) => k.includes(q))
      );
      if (match) setActive(match.id);
    }
  };

  if (data.isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Search inside sidebar */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar configuração..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-2">
          {filteredGroups.map((group) => (
            <div key={group.label} className="mb-1">
              <div className="px-4 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </span>
              </div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActive(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-all duration-150",
                    active === item.id
                      ? "bg-primary/10 text-primary font-medium border-r-2 border-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="h-full">
      {/* Mobile header */}
      <div className="md:hidden flex items-center gap-3 mb-4">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 h-9 w-9">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configurações
              </h2>
            </div>
            {navContent}
          </SheetContent>
        </Sheet>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{activeItem?.label}</h1>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="flex gap-0 h-full">
        {/* Sidebar - desktop only */}
        <div className="hidden md:flex flex-col w-56 shrink-0 border-r bg-muted/30 rounded-l-xl">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-sm flex items-center gap-2 text-foreground">
              <Settings className="h-4 w-4" />
              Configurações
            </h2>
          </div>
          {navContent}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Desktop header */}
          <div className="hidden md:flex items-center justify-between px-6 py-4 border-b">
            <div>
              <h1 className="text-lg font-semibold text-foreground">{activeItem?.label}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {getSubtitle(active)}
              </p>
            </div>
          </div>

          {/* Content area */}
          <div className="p-4 md:p-6 max-w-4xl">
            {active === "geral" && <ConfigGeralTab empresa={data.empresa} saveEmpresa={data.saveEmpresa} />}
            {active === "usuarios" && <ConfigUsuariosTab userProfiles={data.userProfiles} perfisAcesso={data.perfisAcesso} funcionarios={data.funcionarios} loading={data.userProfilesLoading} error={data.userProfilesError as Error | null} onRetry={() => data.refetchUserProfiles?.()} />}
            {active === "pecas" && <ConfigProdutosTab produtosBase={data.produtosBase} marcas={data.marcas} modelos={data.modelos} categorias={data.estoqueCategorias} />}
            {active === "servicos" && <ConfigServicosTab tiposServico={data.tiposServico} />}
            {active === "precos" && <ConfigListaPrecosTab listasPreco={data.listasPreco} />}
            {active === "fornecedores" && <ConfigFornecedoresTab fornecedores={data.fornecedores} />}
            {active === "tecnicos" && <ConfigTecnicosTab funcionarios={data.funcionarios} />}
            {active === "financeiro" && <ConfigFinanceiroTab categoriasFinanceiras={data.categoriasFinanceiras} centrosCusto={data.centrosCusto} formasPagamento={data.formasPagamento} />}
            {active === "estoque" && <ConfigEstoqueTab marcas={data.marcas} modelos={data.modelos} cores={data.cores} capacidades={data.capacidades} />}
            {active === "lojistas" && <ConfigLojistasTab />}
            {active === "status" && <ConfigStatusTab statusOrdem={data.statusOrdem} />}
            {active === "notificacoes" && <ConfigNotificacoesTab templatesMensagem={data.templatesMensagem} />}
            {active === "documentos" && <ConfigDocumentosTab modelosDocumento={data.modelosDocumento} />}
            {active === "exportacao" && <ConfigExportacaoTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function getSubtitle(id: string): string {
  const map: Record<string, string> = {
    geral: "Nome, endereço, contato e identidade visual da empresa",
    usuarios: "Gerencie usuários do sistema e perfis de acesso",
    pecas: "Catálogo de peças — o que cada peça é. Quantidades vêm das compras.",
    servicos: "Tipos de serviço (defeitos/reparos), valores, categorias e comissões",
    precos: "Tabelas de preços personalizadas por cliente",
    fornecedores: "Cadastro de fornecedores e parceiros",
    lojistas: "Gerencie lojistas parceiros B2B e seus acessos",
    tecnicos: "Equipe técnica, especialidades e comissões",
    financeiro: "Categorias, centros de custo e formas de pagamento",
    estoque: "Marcas, modelos, cores e capacidades usados nas Ordens de Serviço",
    status: "Status das ordens de serviço e ordem de exibição",
    notificacoes: "Templates de mensagens automáticas",
    documentos: "Modelos de laudos, recibos e orçamentos",
    exportacao: "Importar e exportar dados do sistema",
  };
  return map[id] || "";
}
