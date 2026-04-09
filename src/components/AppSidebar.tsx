import { LayoutDashboard, Wrench, DollarSign, Users, Cpu } from "lucide-react";
import { NavLink } from "@/components/NavLink";
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
  { title: "Assistência", url: "/assistencia", icon: Wrench },
  { title: "Estoque", url: "/pecas", icon: Cpu },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Clientes", url: "/clientes", icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
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

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
