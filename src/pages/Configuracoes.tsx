import { useState } from "react";
import { Loader2, Building2, Package, Wrench, Truck, Users, DollarSign, Boxes, ListChecks, Bell, FileText, Search } from "lucide-react";
import { useConfiguracoes } from "@/hooks/useConfiguracoes";
import { ConfigGeralTab } from "@/components/configuracoes/ConfigGeralTab";
import { ConfigProdutosTab } from "@/components/configuracoes/ConfigProdutosTab";
import { ConfigServicosTab } from "@/components/configuracoes/ConfigServicosTab";
import { ConfigFornecedoresTab } from "@/components/configuracoes/ConfigFornecedoresTab";
import { ConfigTecnicosTab } from "@/components/configuracoes/ConfigTecnicosTab";
import { ConfigFinanceiroTab } from "@/components/configuracoes/ConfigFinanceiroTab";
import { ConfigEstoqueTab } from "@/components/configuracoes/ConfigEstoqueTab";
import { ConfigStatusTab } from "@/components/configuracoes/ConfigStatusTab";
import { ConfigNotificacoesTab } from "@/components/configuracoes/ConfigNotificacoesTab";
import { ConfigDocumentosTab } from "@/components/configuracoes/ConfigDocumentosTab";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const sections = [
  { id: "geral", label: "Geral", icon: Building2 },
  { id: "produtos", label: "Produtos", icon: Package },
  { id: "servicos", label: "Serviços", icon: Wrench },
  { id: "fornecedores", label: "Fornecedores", icon: Truck },
  { id: "tecnicos", label: "Técnicos", icon: Users },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "estoque", label: "Estoque", icon: Boxes },
  { id: "status", label: "Status e Etapas", icon: ListChecks },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "documentos", label: "Documentos", icon: FileText },
];

export default function Configuracoes() {
  const data = useConfiguracoes();
  const [active, setActive] = useState("geral");
  const [searchTerm, setSearchTerm] = useState("");

  if (data.isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const filteredSections = sections.filter((s) =>
    s.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-subtitle">Central administrativa do sistema</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="md:w-56 shrink-0">
          <div className="sticky top-4 space-y-2">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 text-sm" />
            </div>
            {/* Mobile: horizontal scroll */}
            <div className="flex md:hidden gap-2 overflow-x-auto pb-2">
              {filteredSections.map((s) => (
                <button key={s.id} onClick={() => setActive(s.id)} className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                  active === s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}>
                  <s.icon className="h-3.5 w-3.5" />{s.label}
                </button>
              ))}
            </div>
            {/* Desktop: vertical list */}
            <div className="hidden md:flex flex-col gap-0.5">
              {filteredSections.map((s) => (
                <button key={s.id} onClick={() => setActive(s.id)} className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  active === s.id ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                  <s.icon className="h-4 w-4 shrink-0" />{s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {active === "geral" && <ConfigGeralTab empresa={data.empresa} saveEmpresa={data.saveEmpresa} />}
          {active === "produtos" && <ConfigProdutosTab produtosBase={data.produtosBase} marcas={data.marcas} modelos={data.modelos} categorias={data.estoqueCategorias} />}
          {active === "servicos" && <ConfigServicosTab tiposServico={data.tiposServico} />}
          {active === "fornecedores" && <ConfigFornecedoresTab fornecedores={data.fornecedores} />}
          {active === "tecnicos" && <ConfigTecnicosTab funcionarios={data.funcionarios} />}
          {active === "financeiro" && <ConfigFinanceiroTab categoriasFinanceiras={data.categoriasFinanceiras} centrosCusto={data.centrosCusto} formasPagamento={data.formasPagamento} />}
          {active === "estoque" && <ConfigEstoqueTab estoqueCategorias={data.estoqueCategorias} marcas={data.marcas} modelos={data.modelos} />}
          {active === "status" && <ConfigStatusTab statusOrdem={data.statusOrdem} />}
          {active === "notificacoes" && <ConfigNotificacoesTab templatesMensagem={data.templatesMensagem} />}
          {active === "documentos" && <ConfigDocumentosTab modelosDocumento={data.modelosDocumento} />}
        </div>
      </div>
    </div>
  );
}
