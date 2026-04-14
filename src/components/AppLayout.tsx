import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { NovaOrdemDialog } from "@/components/NovaOrdemDialog";
import { Plus, Search, CheckCircle, Moon, Sun } from "lucide-react";
import { NotificacoesBell } from "@/components/NotificacoesBell";
import { useTheme } from "@/contexts/ThemeContext";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [novaOSOpen, setNovaOSOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b bg-card/80 backdrop-blur-sm px-4 sticky top-0 z-10 gap-2">
            <SidebarTrigger />
            <div className="h-5 w-px bg-border mx-1 hidden sm:block" />
            <div className="flex items-center gap-1.5 overflow-x-auto hidden sm:flex">
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
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <NotificacoesBell />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
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
    </SidebarProvider>
  );
}
