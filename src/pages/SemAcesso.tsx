import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function SemAcesso() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <ShieldOff className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="text-xl font-semibold">Acesso restrito</h1>
      <p className="text-muted-foreground max-w-sm">
        Você não tem permissão para acessar esta área. Entre em contato com o administrador.
      </p>
      <Button variant="outline" onClick={() => navigate("/")}>
        Voltar ao início
      </Button>
    </div>
  );
}
