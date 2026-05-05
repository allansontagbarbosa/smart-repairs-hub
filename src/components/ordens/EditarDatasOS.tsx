import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePermissoes } from "@/hooks/usePermissoes";

function toLocalInput(d: string | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface Props {
  ordem: {
    id: string;
    status: string;
    data_conclusao: string | null;
    data_entrega: string | null;
  };
  onSucesso: () => void;
}

export function EditarDatasOS({ ordem, onSucesso }: Props) {
  const { isAdmin, perfil } = usePermissoes();
  const isGerente = ["gerente", "Gerente"].includes(perfil);
  const podeEditar = (isAdmin || isGerente) && ordem.status !== "cancelado";

  const [concl, setConcl] = useState(toLocalInput(ordem.data_conclusao));
  const [entr, setEntr] = useState(toLocalInput(ordem.data_entrega));
  const [salvando, setSalvando] = useState(false);

  if (!podeEditar) {
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" /> Datas
        </p>
        <div className="text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Conclusão:</span>{" "}
            {ordem.data_conclusao ? new Date(ordem.data_conclusao).toLocaleString("pt-BR") : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Entrega:</span>{" "}
            {ordem.data_entrega ? new Date(ordem.data_entrega).toLocaleString("pt-BR") : "—"}
          </p>
          {ordem.status !== "cancelado" && (
            <p className="text-xs text-muted-foreground italic mt-1">
              Apenas admin/gerente edita datas.
            </p>
          )}
        </div>
      </div>
    );
  }

  const salvar = async () => {
    if (!concl && !entr) {
      toast.error("Informe pelo menos uma data");
      return;
    }
    setSalvando(true);
    const args: any = { p_os_id: ordem.id };
    if (concl) args.p_data_conclusao = new Date(concl).toISOString();
    if (entr) args.p_data_entrega = new Date(entr).toISOString();

    const { data, error } = await supabase.rpc("editar_datas_os" as any, args);
    setSalvando(false);
    const payload = data as any;
    if (error || !payload?.success) {
      toast.error(payload?.error ?? error?.message ?? "Erro ao salvar datas");
      return;
    }
    if (payload.status_mudou) {
      toast.success(
        `Datas atualizadas. Status alterado para "${payload.status_novo}".`,
        { duration: 5000 },
      );
    } else {
      toast.success("Datas atualizadas");
    }
    onSucesso();
  };

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5" /> Datas
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <Label className="text-xs">Conclusão</Label>
          <Input
            type="datetime-local"
            value={concl}
            onChange={(e) => setConcl(e.target.value)}
            max={toLocalInput(new Date().toISOString())}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Entrega</Label>
          <Input
            type="datetime-local"
            value={entr}
            onChange={(e) => setEntr(e.target.value)}
            max={toLocalInput(new Date().toISOString())}
          />
        </div>
      </div>
      <Button size="sm" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar datas"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Mudar a conclusão atualiza também os serviços concluídos. Comissões existentes mantêm seu mês de competência original.
      </p>
    </div>
  );
}
