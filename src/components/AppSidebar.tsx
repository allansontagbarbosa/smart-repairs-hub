import { LayoutDashboard, Wrench, DollarSign, Users, Cpu, Settings, Smartphone, BarChart2, Truck, LogOut } from "lucide-react";
import { AssistProLogo } from "@/components/AssistProLogo";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, permissao: "dashboard" as keyof Permissoes },
  { title: "Assistência", url: "/assistencia", icon: Wrench, badgeKey: "assistencia" as const, permissao: "assistencia" as keyof Permissoes },
  { title: "Aparelhos", url: "/aparelhos", icon: Smartphone, permissao: "assistencia" as keyof Permissoes },
  { title: "Peças", url: "/pecas", icon: Cpu, badgeKey: "pecas" as const, permissao: "pecas" as keyof Permissoes },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck, permissao: "pecas" as keyof Permissoes },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign, badgeKey: "financeiro" as const, permissao: "financeiro" as keyof Permissoes },
  { title: "Relatórios", url: "/relatorios", icon: BarChart2, permissao: "relatorios" as keyof Permissoes },
  { title: "Clientes", url: "/clientes", icon: Users, permissao: "clientes" as keyof Permissoes },
  { title: "Configurações", url: "/configuracoes", icon: Settings, permissao: "configuracoes" as keyof Permissoes },
];

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { badgeCounts } = useNotificacoes();
  const { can } = usePermissoes();
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

  const handleLogout = async () => {
    if (!confirm("Deseja sair do sistema?")) return;
    await supabase.auth.signOut();
    navigate("/login");
  };

  const visibleItems = items.filter((item) => can(item.permissao, "ver"));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        <div className={`flex items-center justify-center px-4 pt-5 pb-4 ${collapsed ? "px-2" : ""}`}>
          {collapsed ? (
            <AssistProLogo iconOnly />
          ) : (
            <AssistProLogo size="sm" />
          )}
        </div>

        {!collapsed && (
          <div className="px-4 mb-2">
            <div className="h-px bg-sidebar-border" />
          </div>
        )}

        <SidebarGroup className="flex-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const badge = item.badgeKey === "pecas" ? estoqueBaixoCount : (item.badgeKey ? (badgeCounts[item.badgeKey] ?? 0) : 0);
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
                        {!collapsed && (
                          <span className="flex-1">{item.title}</span>
                        )}
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Bottom section — user + theme + logout */}
        <div className="border-t border-sidebar-border px-3 pb-3 pt-3 space-y-2">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {iniciais}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-sidebar-foreground truncate">{nome}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <ThemeToggle collapsed={false} />
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1" onClick={handleLogout}>
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
