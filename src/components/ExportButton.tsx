import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { exportRows, type ExportRow } from "@/lib/exportData";

interface Props {
  resource: string;
  sheetName?: string;
  getRows: () => ExportRow[] | Promise<ExportRow[]>;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
  label?: string;
  disabled?: boolean;
}

export function ExportButton({
  resource,
  sheetName = "Dados",
  getRows,
  size = "sm",
  variant = "outline",
  label = "Exportar",
  disabled = false,
}: Props) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: "csv" | "xlsx") => {
    setIsExporting(true);
    try {
      const rows = await getRows();
      if (!rows || rows.length === 0) {
        toast.error("Nenhum dado para exportar com os filtros atuais.");
        return;
      }
      await exportRows(resource, format, rows, sheetName);
      toast.success(`${rows.length} registro${rows.length > 1 ? "s" : ""} exportado${rows.length > 1 ? "s" : ""}.`);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao exportar.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} disabled={disabled || isExporting} className="gap-1.5">
          {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("xlsx")} disabled={isExporting}>
          Exportar Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("csv")} disabled={isExporting}>
          Exportar CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
