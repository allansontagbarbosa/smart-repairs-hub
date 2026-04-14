import { LayoutDashboard, Wrench, DollarSign, Users, Cpu, Settings, Smartphone, BarChart2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
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
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Assistência", url: "/assistencia", icon: Wrench, badgeKey: "aguardando_aprovacao" as const },
  { title: "Aparelhos", url: "/aparelhos", icon: Smartphone },
  { title: "Peças", url: "/pecas", icon: Cpu },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Relatórios", url: "/relatorios", icon: BarChart2, badgeKey: "os_atrasadas" as const },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const { data: aguardandoCount = 0 } = useQuery({
    queryKey: ["os-aguardando-aprovacao-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ordens_de_servico")
        .select("id", { count: "exact", head: true })
        .eq("status", "aguardando_aprovacao")
        .is("deleted_at", null);
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const { data: atrasadasCount = 0 } = useQuery({
    queryKey: ["os-atrasadas-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ordens_de_servico")
        .select("id", { count: "exact", head: true })
        .eq("prazo_vencido", true)
        .not("status", "in", '("pronto","entregue")')
        .is("deleted_at", null);
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        <div className={`flex items-center gap-2.5 px-4 pt-5 pb-4 ${collapsed ? "justify-center px-2" : ""}`}>
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-sidebar-accent">
            <Wrench className="h-4 w-4 text-sidebar-ring" />
          </div>
          {!collapsed && (
            <span className="text-base font-semibold text-sidebar-primary tracking-tight">
              CellFix
            </span>
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
              {items.map((item) => {
                const badge = item.badgeKey === "aguardando_aprovacao" ? aguardandoCount : 0;
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
                          <span className="inline-flex items-center justify-center rounded-full bg-warning text-warning-foreground text-[10px] font-bold h-5 min-w-5 px-1.5">
                            {badge}
                          </span>
                        )}
                        {collapsed && badge > 0 && (
                          <span className="absolute top-0 right-0 inline-flex items-center justify-center rounded-full bg-warning text-warning-foreground text-[8px] font-bold h-4 min-w-4 px-1">
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

        {/* Bottom section */}
        <div className={`px-3 pb-4 pt-2 border-t border-sidebar-border ${collapsed ? "flex justify-center" : "flex items-center gap-2"}`}>
          <ThemeToggle collapsed={collapsed} />
          {!collapsed && (
            <span className="text-[11px] text-sidebar-muted">Tema</span>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
