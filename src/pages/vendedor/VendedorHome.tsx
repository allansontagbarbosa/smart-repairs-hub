import { useTecnicoIdentidade } from "@/hooks/useTecnico";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Sparkles } from "lucide-react";

export default function VendedorHome() {
  const { data: identidade } = useTecnicoIdentidade();
  const primeiroNome = (identidade?.nome || "vendedor").split(" ")[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {primeiroNome} 👋</h1>
        <p className="text-sm text-muted-foreground">Bem-vindo ao seu portal de vendedor.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Seu painel está sendo montado
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Em breve seus <strong>pedidos</strong>, <strong>clientes</strong>, <strong>catálogo</strong> e{" "}
            <strong>comissões</strong> aparecem aqui.
          </p>
          <div className="flex items-center gap-2 pt-2 text-xs">
            <Store className="h-3.5 w-3.5" />
            <span>Acesso restrito · você só vê o que precisa pra vender.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
