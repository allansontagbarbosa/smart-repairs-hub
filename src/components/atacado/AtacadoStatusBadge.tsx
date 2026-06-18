import { Badge } from "@/components/ui/badge";

export type StatusCatalogoRow = { nome: string; categoria: string | null };

export function getStatusCategoria(
  s: string | null | undefined,
  catalogo: StatusCatalogoRow[],
): string {
  if (!s) return "outro";
  const found = catalogo.find(
    (r) => r.nome?.toLowerCase() === String(s).toLowerCase(),
  );
  if (found?.categoria) return found.categoria;
  const low = String(s).toLowerCase();
  if (/(transit|transporte|caminho|envio)/.test(low)) return "em_transito";
  if (/(reserv|separad|aguard)/.test(low)) return "reservado";
  if (/(vendid|baixad|entregue)/.test(low)) return "vendido";
  if (/(estoq|stoq|disponiv)/.test(low)) return "em_estoque";
  if (/(assist|defeito|conserto|manut)/.test(low)) return "outro";
  return "em_estoque";
}

const CLASSES: Record<string, string> = {
  em_estoque: "bg-success/15 text-success border-success/30",
  reservado: "bg-warning/15 text-warning border-warning/30",
  vendido: "bg-muted text-muted-foreground border-border",
  em_transito: "bg-info/15 text-info border-info/30",
  outro: "bg-muted/50 text-foreground border-border",
};

export function AtacadoStatusBadge({
  status,
  catalogo,
}: {
  status: string | null | undefined;
  catalogo: StatusCatalogoRow[];
}) {
  const cat = getStatusCategoria(status, catalogo);
  const cls = CLASSES[cat] ?? CLASSES.outro;
  return (
    <Badge variant="outline" className={cls}>
      {status ?? "—"}
    </Badge>
  );
}
