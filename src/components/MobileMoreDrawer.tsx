import { useNavigate } from "react-router-dom";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Cpu, ShoppingCart, Truck, ReceiptText, Users, BarChart2,
  Settings, LogOut, Smartphone, Wrench, Sun, Moon,
} from "lucide-react";
import { usePermissoes, type Permissoes } from "@/hooks/usePermissoes";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { DittLogo } from "@/components/DittLogo";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const items = [
  { title: "Aparelhos", url: "/aparelhos", icon: Smartphone, permissao: "assistencia" as keyof Permissoes },
  { title: "Peças", url: "/pecas", icon: Cpu, permissao: "pecas" as keyof Permissoes },
  { title: "Compras", url: "/compras", icon: ShoppingCart, permissao: "pecas" as keyof Permissoes },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck, permissao: "pecas" as keyof Permissoes },
  { title: "Faturas B2B", url: "/financeiro/faturas-lojistas", icon: ReceiptText, permissao: "financeiro" as keyof Permissoes },
  { title: "Clientes", url: "/clientes", icon: Users, permissao: "clientes" as keyof Permissoes },
  { title: "Relatórios", url: "/relatorios", icon: BarChart2, permissao: "relatorios" as keyof Permissoes },
  { title: "Configurações", url: "/configuracoes", icon: Settings, permissao: "configuracoes" as keyof Permissoes },
];

export function MobileMoreDrawer({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { can } = usePermissoes();
  const { resolvedTheme, setTheme } = useTheme();

  const visible = items.filter((i) => can(i.permissao, "ver"));

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
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-2 mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">
              Atalhos
            </p>
            <button
              type="button"
              onClick={() => go("/assistencia?status=pronto")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-sm"
            >
              <Wrench className="h-4 w-4 text-primary" />
              OS prontas
            </button>
          </div>

          <div className="px-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">
              Navegar
            </p>
            {visible.map((item) => (
              <button
                key={item.url}
                type="button"
                onClick={() => go(item.url)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-sm"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                {item.title}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t p-3">
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
