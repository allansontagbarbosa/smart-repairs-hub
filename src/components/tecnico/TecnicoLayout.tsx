import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, useLocation } from "react-router-dom";
import { LayoutGrid, ClipboardList, Target, ArrowLeftRight, LogOut, Wrench } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTecnicoIdentidade } from "@/hooks/useTecnico";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

export function TecnicoGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { data: identidade, isLoading } = useTecnicoIdentidade();
  const [vinculo, setVinculo] = useState<"loading" | "ok" | "sem-vinculo" | "no-auth">("loading");

  useEffect(() => {
    if (loading || isLoading) return;
    if (!user) return setVinculo("no-auth");
    if (!identidade) return setVinculo("no-auth");
    if (!identidade.funcionario_id) return setVinculo("sem-vinculo");
    setVinculo("ok");
  }, [user, loading, isLoading, identidade]);

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
          <Wrench className="h-12 w-12 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold">Acesso de técnico não vinculado</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta ainda não está vinculada a um funcionário técnico. Peça ao administrador para
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
  { to: "/tecnico", icon: LayoutGrid, label: "Início", end: true },
  { to: "/tecnico/ordens", icon: ClipboardList, label: "Minhas OS" },
  { to: "/tecnico/metas", icon: Target, label: "Metas" },
  { to: "/tecnico/transferencias", icon: ArrowLeftRight, label: "Transferências" },
];

export function TecnicoLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const { data: identidade } = useTecnicoIdentidade();
  const location = useLocation();
  const initials = (identidade?.nome || "T").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/tecnico" className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <Wrench className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">Portal do Técnico</p>
              <p className="text-[11px] text-muted-foreground leading-tight truncate">
                {identidade?.nome}
              </p>
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

      {/* Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-4 pb-24">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          {NAV.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] transition-colors",
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

      {/* hint key for current path (avoids unused var warning) */}
      <span className="hidden">{location.pathname}</span>
    </div>
  );
}
