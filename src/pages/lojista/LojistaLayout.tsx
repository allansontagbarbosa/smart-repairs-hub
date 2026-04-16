import { NavLink, useNavigate } from "react-router-dom";
import { AssistProLogo } from "@/components/AssistProLogo";
import { Button } from "@/components/ui/button";
import { useLojistaAuth } from "@/hooks/useLojistaAuth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Smartphone, DollarSign, ShieldCheck, History, LogOut,
} from "lucide-react";

const navItems = [
  { to: "/lojista", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/lojista/aparelhos", label: "Aparelhos", icon: Smartphone },
  { to: "/lojista/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/lojista/garantias", label: "Garantias", icon: ShieldCheck },
  { to: "/lojista/historico", label: "Histórico", icon: History },
];

export default function LojistaLayout({ children }: { children: React.ReactNode }) {
  const { lojistaUser, lojistaSignOut } = useLojistaAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await lojistaSignOut();
    navigate("/lojista/login", { replace: true });
  };

  const initials = (lojistaUser?.lojista?.nome || lojistaUser?.nome || "L")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AssistProLogo size="sm" />
            <div className="flex items-center gap-1.5 ml-1">
              <p className="text-[10px] text-muted-foreground">Portal Lojista</p>
              <span className="text-[9px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">B2B</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-medium leading-tight">{lojistaUser?.lojista?.nome || lojistaUser?.nome}</p>
                <p className="text-[10px] text-muted-foreground">{lojistaUser?.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={handleSignOut}>
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>

        {/* Nav */}
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
