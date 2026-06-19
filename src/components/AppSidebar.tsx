import { LayoutDashboard, Wrench, DollarSign, Users, Cpu, Settings, Smartphone, BarChart2, Truck, LogOut, ShoppingCart, ReceiptText, Trophy, Target, UserCog, Tv, PiggyBank, Wallet, Store, Zap, ArrowLeftRight, CreditCard, ClipboardList, Tv2, Briefcase, ShoppingBag, Sparkles, ChevronRight, Kanban, Send, Clock, Handshake } from "lucide-react";
import { DittLogo } from "@/components/DittLogo";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { useWorkspaceMode } from "@/contexts/WorkspaceModeContext";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { usePermissoes, type Permissoes } from "@/hooks/usePermissoes";
import { useEstoqueBaixoCount } from "@/hooks/useEstoqueBaixoCount";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, permissao: "dashboard" as keyof Permissoes },
  { title: "Assistência", url: "/assistencia", icon: Wrench, badgeKey: "assistencia" as const, permissao: "assistencia" as keyof Permissoes },
  { title: "Operacional", url: "/operacional", icon: Kanban, permissao: "assistencia" as keyof Permissoes },
  { title: "Aparelhos na rua", url: "/assistencia/aparelhos-na-rua", icon: Send, permissao: "assistencia" as keyof Permissoes },
  { title: "Aparelhos", url: "/aparelhos", icon: Smartphone, permissao: "aparelhos" as keyof Permissoes },
  { title: "Peças", url: "/pecas", icon: Cpu, badgeKey: "pecas" as const, permissao: "pecas" as keyof Permissoes },
  { title: "Compras", url: "/compras", icon: ShoppingCart, permissao: "compras" as keyof Permissoes },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck, permissao: "fornecedores" as keyof Permissoes },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign, badgeKey: "financeiro" as const, permissao: "financeiro" as keyof Permissoes },
  { title: "Faturas B2B", url: "/financeiro/faturas-lojistas", icon: ReceiptText, permissao: "faturas_b2b" as keyof Permissoes },
  { title: "Cashback", url: "/cashback", icon: Wallet, permissao: "financeiro" as keyof Permissoes },
  { title: "Relatórios", url: "/relatorios", icon: BarChart2, permissao: "relatorios" as keyof Permissoes },
  { title: "Desempenho técnicos", url: "/tecnicos/desempenho", icon: Trophy, permissao: "desempenho_tecnicos" as keyof Permissoes },
  { title: "Metas", url: "/metas", icon: Target, permissao: "metas" as keyof Permissoes },
  { title: "Clientes", url: "/clientes", icon: Users, permissao: "clientes" as keyof Permissoes },
  { title: "RH", url: "/rh", icon: UserCog, permissao: "rh" as keyof Permissoes },
  { title: "Painéis TV", url: "/tv/configurar", icon: Tv, permissao: "paineis_tv" as keyof Permissoes },
  { title: "Configurações", url: "/configuracoes", icon: Settings, permissao: "configuracoes" as keyof Permissoes },
];

const itemsLoja = [
  { title: "Dashboard Loja", url: "/loja/dashboard", icon: LayoutDashboard, permissao: "loja_dashboard" as keyof Permissoes },
  { title: "PDV", url: "/loja/pdv", icon: Zap, permissao: "loja_pdv" as keyof Permissoes },
  { title: "Vendas", url: "/loja/vendas", icon: ClipboardList, permissao: "loja_vendas" as keyof Permissoes },
  { title: "Aparelhos Loja", url: "/loja/aparelhos", icon: Store, permissao: "loja_aparelhos" as keyof Permissoes },
  { title: "Compras Loja", url: "/loja/compras", icon: ShoppingBag, permissao: "loja_compras" as keyof Permissoes },
  { title: "Trade-in", url: "/loja/trade-in", icon: ArrowLeftRight, permissao: "loja_trade_in" as keyof Permissoes },
  { title: "Crediário", url: "/loja/crediario", icon: CreditCard, permissao: "loja_crediario" as keyof Permissoes },
  { title: "Vendedores", url: "/loja/vendedores", icon: Briefcase, permissao: "loja_vendedores" as keyof Permissoes },
  { title: "Metas Loja", url: "/loja/metas", icon: Target, permissao: "loja_metas" as keyof Permissoes },
  { title: "Telão Loja", url: "/loja/tv", icon: Tv2, permissao: "loja_tv" as keyof Permissoes },
  { title: "Financeiro Loja", url: "/loja/financeiro", icon: DollarSign, permissao: "loja_financeiro" as keyof Permissoes },
  { title: "Relatórios Loja", url: "/loja/relatorios", icon: BarChart2, permissao: "loja_relatorios" as keyof Permissoes },
  { title: "Clientes Loja", url: "/loja/clientes", icon: Users, permissao: "loja_clientes" as keyof Permissoes },
  { title: "Config. Loja", url: "/loja/configuracoes", icon: Settings, permissao: "loja_configuracoes" as keyof Permissoes },
];

const itemsAtacado = [
  { title: "Dashboard Atacado", url: "/atacado/dashboard", icon: LayoutDashboard, permissao: "atacado_dashboard" as keyof Permissoes },
  { title: "Pedidos", url: "/atacado/pedidos", icon: ClipboardList, permissao: "atacado_pedidos" as keyof Permissoes },
  { title: "Novo Pedido", url: "/atacado/novo-pedido", icon: Zap, permissao: "atacado_pedidos" as keyof Permissoes },
  { title: "Clientes B2B", url: "/atacado/clientes", icon: Users, permissao: "atacado_clientes" as keyof Permissoes },
  { title: "Estoque Atacado", url: "/atacado/aparelhos", icon: Smartphone, permissao: "atacado_aparelhos" as keyof Permissoes },
  { title: "Tabelas de Preço", url: "/atacado/tabelas-preco", icon: ReceiptText, permissao: "atacado_tabelas_preco" as keyof Permissoes },
  { title: "Vendedores B2B", url: "/atacado/vendedores", icon: Briefcase, permissao: "atacado_vendedores" as keyof Permissoes },
  { title: "Metas Atacado", url: "/atacado/metas", icon: Target, permissao: "atacado_metas" as keyof Permissoes },
  { title: "Financeiro Atacado", url: "/atacado/financeiro", icon: DollarSign, permissao: "atacado_financeiro" as keyof Permissoes },
  { title: "Cobrança", url: "/atacado/cobranca", icon: Wallet, permissao: "atacado_cobranca" as keyof Permissoes },
  { title: "Relatórios Atacado", url: "/atacado/relatorios", icon: BarChart2, permissao: "atacado_relatorios" as keyof Permissoes },
  { title: "Ofertas", url: "/atacado/ofertas", icon: Handshake, permissao: "atacado_pedidos" as keyof Permissoes },
  { title: "Catálogo Público", url: "/atacado/catalogo-publico", icon: Store, permissao: "atacado_configuracoes" as keyof Permissoes },
  { title: "Config. Atacado", url: "/atacado/configuracoes", icon: Settings, permissao: "atacado_configuracoes" as keyof Permissoes },
];

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { badgeCounts } = useNotificacoes();
  const { can } = usePermissoes();
  const { mode } = useWorkspaceMode();
  const estoqueBaixoCount = useEstoqueBaixoCount();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ['sidebar-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('nome_exibicao, funcionario_id, funcionarios(nome, cargo)')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const nome = (profile as any)?.funcionarios?.nome || profile?.nome_exibicao || user?.email?.split("@")[0] || "Usuário";
  const email = user?.email || "";
  const iniciais = getInitials(nome);
  const ehFuncionario = !!(profile as any)?.funcionario_id;

  // ADM ou sócio — quem pode ver o Painel do Sócio
  const { data: ehSocio } = useQuery({
    queryKey: ['sidebar-eh-adm-ou-socio', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_adm_ou_socio' as any);
      if (!error) return Boolean(data);
      const { data: row } = await supabase
        .from('socios')
        .select('id')
        .eq('user_id', user!.id)
        .eq('ativo', true)
        .is('deleted_at', null)
        .maybeSingle();
      return !!row;
    },
    enabled: !!user?.id,
  });

  const handleLogout = async () => {
    if (!confirm("Deseja sair do sistema?")) return;
    await supabase.auth.signOut();
    navigate("/login");
  };

  const itemsVisiveis = (() => {
    if (mode === "loja") return itemsLoja.filter((item) => can(item.permissao, "ver"));
    if (mode === "atacado") return itemsAtacado.filter((item) => can(item.permissao, "ver"));
    return items.filter((item) => can(item.permissao, "ver"));
  })();

  const painelSocioPath =
    mode === "loja" ? "/loja/painel-socio" : mode === "atacado" ? "/atacado/painel-socio" : "/painel-socio";
  const painelSocioLabel =
    mode === "loja" ? "Painel Sócio · Loja" : mode === "atacado" ? "Painel Sócio · Atacado" : "Painel do Sócio";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        <div className={`flex items-center justify-center px-4 pt-5 pb-4 ${collapsed ? "px-2" : ""}`}>
          {collapsed ? (
            <DittLogo iconOnly variant="dark" />
          ) : (
            <DittLogo size="sm" variant="dark" className="text-sidebar-foreground" />
          )}
        </div>

        <WorkspaceSwitcher collapsed={collapsed} />

        {!collapsed && (
          <div className="px-4 mb-2">
            <div className="h-px bg-sidebar-border" />
          </div>
        )}

        <SidebarGroup className="flex-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {itemsVisiveis.map((item: any) => {
                const badge =
                  item.badgeKey === "pecas"
                    ? estoqueBaixoCount
                    : item.badgeKey
                    ? badgeCounts[item.badgeKey as keyof typeof badgeCounts] ?? 0
                    : 0;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span className="flex-1">{item.title}</span>}
                        {!collapsed && badge > 0 && (
                          <span className="inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold h-5 min-w-5 px-1.5">
                            {badge}
                          </span>
                        )}
                        {collapsed && badge > 0 && (
                          <span className="absolute top-0 right-0 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold h-4 min-w-4 px-1">
                            {badge}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {ehSocio && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={painelSocioPath}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <PiggyBank className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="flex-1">{painelSocioLabel}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {ehFuncionario && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/meu-ponto"
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <Clock className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="flex-1">Meu ponto</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        {/* Bottom section — user + theme + logout */}
        <div className="border-t border-sidebar-border px-3 pb-3 pt-3 space-y-2">
          {!collapsed ? (
            <>
              <button
                onClick={() => navigate("/minha-conta")}
                title="Abrir Minha conta"
                className="group flex items-center gap-2.5 w-full p-2 rounded-md hover:bg-sidebar-accent text-left transition-colors"
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {iniciais}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-sidebar-foreground truncate">{nome}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{email}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
              <div className="flex items-center justify-between px-1">
                <ThemeToggle collapsed={false} />
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1 px-2" onClick={handleLogout}>
                  <LogOut className="h-3 w-3" />
                  Sair
                </Button>
              </div>

            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ThemeToggle collapsed={true} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleLogout} className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-bold hover:bg-destructive/10 hover:text-destructive transition-colors">
                    {iniciais}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{nome}</p>
                  <p className="text-xs text-muted-foreground">Clique para sair</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
