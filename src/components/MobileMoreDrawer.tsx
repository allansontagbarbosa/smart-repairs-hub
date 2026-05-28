import { useNavigate } from "react-router-dom";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Wrench, DollarSign, Users, Cpu, Settings, Smartphone, BarChart2,
  Truck, LogOut, Trophy, Target, UserCog, Tv, ShoppingCart, ReceiptText, Wallet,
  PiggyBank, Sun, Moon,
} from "lucide-react";
import { usePermissoes, type Permissoes } from "@/hooks/usePermissoes";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DittLogo } from "@/components/DittLogo";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const sections: Array<{
  title: string;
  items: Array<{ title: string; url: string; icon: any; permissao?: keyof Permissoes }>;
}> = [
  {
    title: "Operação",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, permissao: "dashboard" as keyof Permissoes },
      { title: "Assistência", url: "/assistencia", icon: Wrench, permissao: "assistencia" as keyof Permissoes },
      { title: "Aparelhos", url: "/aparelhos", icon: Smartphone, permissao: "assistencia" as keyof Permissoes },
      { title: "Clientes", url: "/clientes", icon: Users, permissao: "clientes" as keyof Permissoes },
    ],
  },
  {
    title: "Estoque & Compras",
    items: [
      { title: "Peças", url: "/pecas", icon: Cpu, permissao: "pecas" as keyof Permissoes },
      { title: "Compras", url: "/compras", icon: ShoppingCart, permissao: "pecas" as keyof Permissoes },
      { title: "Fornecedores", url: "/fornecedores", icon: Truck, permissao: "pecas" as keyof Permissoes },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { title: "Financeiro", url: "/financeiro", icon: DollarSign, permissao: "financeiro" as keyof Permissoes },
      { title: "Faturas B2B", url: "/financeiro/faturas-lojistas", icon: ReceiptText, permissao: "financeiro" as keyof Permissoes },
      { title: "Cashback", url: "/cashback", icon: Wallet, permissao: "financeiro" as keyof Permissoes },
      { title: "Relatórios", url: "/relatorios", icon: BarChart2, permissao: "relatorios" as keyof Permissoes },
    ],
  },
  {
    title: "Equipe & Metas",
    items: [
      { title: "Desempenho técnicos", url: "/tecnicos/desempenho", icon: Trophy, permissao: "relatorios" as keyof Permissoes },
      { title: "Metas", url: "/metas", icon: Target, permissao: "relatorios" as keyof Permissoes },
      { title: "RH", url: "/rh", icon: UserCog, permissao: "configuracoes" as keyof Permissoes },
    ],
  },
  {
    title: "Sistema",
    items: [
      { title: "Painéis TV", url: "/tv/configurar", icon: Tv, permissao: "configuracoes" as keyof Permissoes },
      { title: "Configurações", url: "/configuracoes", icon: Settings, permissao: "configuracoes" as keyof Permissoes },
    ],
  },
];

export function MobileMoreDrawer({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { can } = usePermissoes();
  const { resolvedTheme, setTheme } = useTheme();
  const { user } = useAuth();

  const { data: ehSocio } = useQuery({
    queryKey: ["drawer-eh-socio", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("socios")
        .select("id")
        .eq("user_id", user!.id)
        .eq("ativo", true)
        .is("deleted_at", null)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
  });

  const handleLogout = async () => {
    if (!confirm("Deseja sair do sistema?")) return;
    await supabase.auth.signOut();
    navigate("/login");
  };

  const go = (url: string) => {
    onOpenChange(false);
    navigate(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[85vw] max-w-sm p-0 flex flex-col">
        <SheetHeader className="px-4 py-4 border-b">
          <SheetTitle className="flex items-center justify-between gap-2">
            <DittLogo size="sm" variant={resolvedTheme === "dark" ? "white" : "default"} />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              title="Alternar tema"
              aria-label="Alternar tema"
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {ehSocio && (
            <div className="px-3 pt-2 pb-1">
              <button
                type="button"
                onClick={() => go("/painel-socio")}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-sm font-medium active:scale-[0.99] transition-transform"
              >
                <PiggyBank className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Painel do Sócio
              </button>
            </div>
          )}

          {sections.map((section) => {
            const visibleItems = section.items.filter((i) => !i.permissao || can(i.permissao, "ver"));
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.title} className="px-2 mt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">
                  {section.title}
                </p>
                {visibleItems.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => go(item.url)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted active:bg-muted/70 text-sm active:scale-[0.99] transition-transform"
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    {item.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        <div
          className="border-t p-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
