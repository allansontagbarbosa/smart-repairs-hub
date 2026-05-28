import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { NovaOrdemDialog } from "@/components/NovaOrdemDialog";
import { Plus, Search, CheckCircle, Moon, Sun, Keyboard, LogOut, User as UserIcon } from "lucide-react";
import { NotificacoesSino } from "@/components/layout/NotificacoesSino";
import { SocioNotificacoesSino } from "@/components/layout/SocioNotificacoesSino";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ShortcutsHelp } from "@/components/ShortcutsHelp";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { MobileMoreDrawer } from "@/components/MobileMoreDrawer";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DittLogo } from "@/components/DittLogo";
import { BotaoFlutuanteIA } from "@/components/ia/BotaoFlutuanteIA";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [novaOSOpen, setNovaOSOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["applayout-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("nome_exibicao, funcionarios(nome)")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const nome = (profile as any)?.funcionarios?.nome || profile?.nome_exibicao || user?.email?.split("@")[0] || "Usuário";
  const email = user?.email || "";
  const iniciais = getInitials(nome);

  const handlers = useMemo(
    () => ({
      onNewOS: () => setNovaOSOpen(true),
      onGlobalSearch: () => setSearchOpen(true),
    }),
    []
  );

  useKeyboardShortcuts(handlers);

  const handleLogout = async () => {
    if (!confirm("Deseja sair do sistema?")) return;
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Sidebar oculta no mobile (substituída por bottom nav) */}
        <div className="hidden lg:flex">
          <AppSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 lg:h-12 flex items-center border-b bg-card/80 backdrop-blur-sm px-3 lg:px-4 sticky top-0 z-30 gap-1.5 lg:gap-2" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            {/* Mobile: logo Ditt à esquerda */}
            <div className="lg:hidden flex items-center">
              <DittLogo size="sm" variant={resolvedTheme === "dark" ? "white" : "default"} />
            </div>

            {/* Desktop: trigger + atalhos */}
            <div className="hidden lg:flex items-center gap-2 flex-1">
              <SidebarTrigger />
              <div className="h-5 w-px bg-border mx-1" />
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs gap-1.5 shrink-0"
                  onClick={() => setNovaOSOpen(true)}
                >
                  <Plus className="h-3 w-3" /> Nova OS
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1.5 shrink-0"
                  onClick={() => navigate("/clientes")}
                >
                  <Search className="h-3 w-3" /> Clientes
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1.5 shrink-0"
                  onClick={() => navigate("/assistencia?status=pronto")}
                >
                  <CheckCircle className="h-3 w-3" /> Prontos
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1.5 shrink-0"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="h-3 w-3" />
                  <span className="hidden lg:inline">Buscar</span>
                  <kbd className="hidden lg:inline ml-1 rounded border bg-muted px-1 text-[10px] font-mono">⌘K</kbd>
                </Button>
              </div>
            </div>

            {/* Direita: notificações sempre, atalhos+tema só desktop, busca+avatar só mobile */}
            <div className="ml-auto flex items-center gap-1">
              {/* Mobile: ícone de busca */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 sm:hidden"
                onClick={() => setSearchOpen(true)}
                aria-label="Buscar"
              >
                <Search className="h-4 w-4" />
              </Button>

              {/* Desktop: atalhos + tema */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hidden sm:inline-flex"
                onClick={() => setShortcutsOpen(true)}
                title="Atalhos de teclado"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hidden sm:inline-flex"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              <SocioNotificacoesSino />
              <NotificacoesSino />

              {/* Mobile: avatar com menu de perfil/sair */}
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-9 w-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center active:scale-95 transition-transform"
                      aria-label="Menu do usuário"
                    >
                      {iniciais}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium truncate">{nome}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{email}</span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
                      {resolvedTheme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                      Tema {resolvedTheme === "dark" ? "claro" : "escuro"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/configuracoes")}>
                      <UserIcon className="h-4 w-4 mr-2" />
                      Minha conta
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto pb-24 sm:pb-4">
            <div className="max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>

      <NovaOrdemDialog
        open={novaOSOpen}
        onOpenChange={setNovaOSOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["ordens"] })}
      />

      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNewOS={() => setNovaOSOpen(true)}
      />

      <ShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      <MobileMoreDrawer open={moreDrawerOpen} onOpenChange={setMoreDrawerOpen} />

      <MobileBottomNav
        onNewOS={() => setNovaOSOpen(true)}
        onMoreClick={() => setMoreDrawerOpen(true)}
      />

      <BotaoFlutuanteIA />
    </SidebarProvider>
  );
}
