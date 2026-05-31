import { useModulos } from "@/hooks/useModulos";
import { Building2, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
}

export function ModuloAtacadoGuard({ children }: Props) {
  const { atacadoAtivo, isLoading } = useModulos();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!atacadoAtivo) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Módulo Atacado não está ativo</h2>
          <p className="text-sm text-muted-foreground">
            Essa funcionalidade faz parte do módulo Atacado B2B. Entre em contato com o suporte Ditt
            ou ative o módulo no seu plano para começar a usar.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" /> Voltar ao Dashboard
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/configuracoes">Ver planos</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
