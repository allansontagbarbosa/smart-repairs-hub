import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, useLocation } from "react-router-dom";
import { LayoutGrid, LogOut, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTecnicoIdentidade } from "@/hooks/useTecnico";
import { usePermissoes } from "@/hooks/usePermissoes";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

export function VendedorGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { data: identidade, isLoading } = useTecnicoIdentidade();
  const { isAdmin, loading: permLoading } = usePermissoes();
  const [vinculo, setVinculo] = useState<"loading" | "ok" | "sem-vinculo" | "no-auth">("loading");

  useEffect(() => {
    if (loading || isLoading || permLoading) return;
    if (!user) return setVinculo("no-auth");
    if (!identidade) return setVinculo("no-auth");
    // Admins podem visualizar mesmo sem funcionario_id (modo visualização)
    if (!identidade.funcionario_id && !isAdmin) return setVinculo("sem-vinculo");
    setVinculo("ok");
  }, [user, loading, isLoading, identidade, isAdmin, permLoading]);

  if (vinculo === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (vinculo === "no-auth") return <Navigate to="/login" replace />;
  if (vinculo === "sem-vinculo") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-4">
          <Store className="h-12 w-12 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold">Acesso de vendedor não vinculado</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta ainda não está vinculada a um funcionário vendedor. Peça ao administrador para
            vincular seu usuário em <strong>Configurações → Usuários e Acessos</strong>.
          </p>
          <Link to="/login">
            <Button variant="outline">Voltar ao login</Button>
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

const NAV = [
  { to: "/vendedor", icon: LayoutGrid, label: "Início", end: true },
];

export function VendedorLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const { data: identidade } = useTecnicoIdentidade();
  const location = useLocation();
  const initials = (identidade?.nome || "V")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 md:hidden">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/vendedor" className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <Store className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">Portal do Vendedor</p>
              <p className="text-[11px] text-muted-foreground leading-tight truncate">{identidade?.nome}</p>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex w-full">
        <aside className="hidden md:flex w-60 shrink-0 border-r bg-card/50 flex-col sticky top-0 h-screen">
          <Link to="/vendedor" className="flex items-center gap-2 px-4 h-16 border-b">
            <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">Portal do Vendedor</p>
              <p className="text-[11px] text-muted-foreground leading-tight truncate">{identidade?.nome}</p>
            </div>
          </Link>

          <nav className="flex-1 p-2 space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t p-2 flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{identidade?.nome}</p>
              <p className="text-[10px] text-muted-foreground truncate">{identidade?.cargo || "Vendedor"}</p>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </aside>

        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-4 pb-24 md:pb-8">{children}</main>
      </div>

      <nav className="fixed bottom-0 inset-x-0 z-30 border-t bg-card/95 backdrop-blur md:hidden">
        <div className="max-w-3xl mx-auto grid grid-cols-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <span className="hidden">{location.pathname}</span>
    </div>
  );
}
