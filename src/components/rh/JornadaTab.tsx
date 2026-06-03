import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useJornadaFuncionario, useSalvarJornada, type JornadaDia } from "@/hooks/useJornada";

const DIAS = [
  { id: 0, label: "Domingo" },
  { id: 1, label: "Segunda" },
  { id: 2, label: "Terça" },
  { id: 3, label: "Quarta" },
  { id: 4, label: "Quinta" },
  { id: 5, label: "Sexta" },
  { id: 6, label: "Sábado" },
];

const PADRAO: JornadaDia[] = DIAS.map((d) => {
  if (d.id === 0) return { dia_semana: 0, ent1: null, sai1: null, ent2: null, sai2: null, horas_previstas: 0, folga: true };
  if (d.id === 6) return { dia_semana: 6, ent1: "09:00", sai1: "13:00", ent2: null, sai2: null, horas_previstas: 4, folga: false };
  return { dia_semana: d.id, ent1: "09:00", sai1: "13:00", ent2: "14:00", sai2: "18:00", horas_previstas: 8, folga: false };
});

function calcHoras(j: JornadaDia): number {
  if (j.folga) return 0;
  const span = (a?: string | null, b?: string | null) => {
    if (!a || !b) return 0;
    const [ah, am] = a.split(":").map(Number);
    const [bh, bm] = b.split(":").map(Number);
    return Math.max(0, (bh * 60 + bm - ah * 60 - am) / 60);
  };
  return span(j.ent1, j.sai1) + span(j.ent2, j.sai2);
}

function toHmm(t: string | null): string {
  if (!t) return "";
  return t.slice(0, 5);
}

export function JornadaTab({ funcionarioId, funcionarioNome }: { funcionarioId: string; funcionarioNome: string }) {
  const { data: salva, isLoading } = useJornadaFuncionario(funcionarioId);
  const salvar = useSalvarJornada();
  const [jornada, setJornada] = useState<JornadaDia[]>(PADRAO);

  useEffect(() => {
    if (!salva) return;
    if (salva.length === 0) {
      setJornada(PADRAO);
      return;
    }
    const map = new Map(salva.map((j) => [j.dia_semana, j]));
    setJornada(
      DIAS.map((d) => {
        const j = map.get(d.id);
        return j
          ? {
              dia_semana: d.id,
              ent1: toHmm(j.ent1),
              sai1: toHmm(j.sai1),
              ent2: toHmm(j.ent2),
              sai2: toHmm(j.ent2 ? j.sai2 : null),
              horas_previstas: j.horas_previstas != null ? Number(j.horas_previstas) : 0,
              folga: j.folga,
            }
          : { dia_semana: d.id, ent1: null, sai1: null, ent2: null, sai2: null, horas_previstas: 0, folga: true };
      })
    );
  }, [salva]);

  const update = (idx: number, patch: Partial<JornadaDia>) => {
    setJornada((prev) => {
      const next = [...prev];
      const merged = { ...next[idx], ...patch };
      merged.horas_previstas = calcHoras(merged);
      next[idx] = merged;
      return next;
    });
  };

  const total = jornada.reduce((s, j) => s + (j.folga ? 0 : calcHoras(j)), 0);

  const handleSalvar = async () => {
    try {
      await salvar.mutateAsync({
        funcionario_id: funcionarioId,
        jornada: jornada.map((j) => ({
          ...j,
          ent1: j.folga ? null : j.ent1 || null,
          sai1: j.folga ? null : j.sai1 || null,
          ent2: j.folga ? null : j.ent2 || null,
          sai2: j.folga ? null : j.sai2 || null,
        })),
      });
      toast.success("Jornada salva. Banco de horas será recalculado.");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-lg font-semibold">Jornada semanal</h3>
            <p className="text-xs text-muted-foreground">
              Horários previstos de {funcionarioNome}. Usado para calcular o banco de horas (trabalhado − previsto).
            </p>
          </div>
          <div className="text-sm">
            Total semanal: <span className="font-semibold">{total.toFixed(1)}h</span>
          </div>
        </div>

        <div className="space-y-2">
          {jornada.map((j, idx) => (
            <div
              key={j.dia_semana}
              className="grid grid-cols-12 gap-2 items-center border rounded-md p-3"
            >
              <div className="col-span-12 md:col-span-2 font-medium text-sm">{DIAS[idx].label}</div>
              <div className="col-span-6 md:col-span-2 flex items-center gap-2">
                <Switch checked={j.folga} onCheckedChange={(v) => update(idx, { folga: v })} />
                <span className="text-xs text-muted-foreground">{j.folga ? "Folga" : "Trabalha"}</span>
              </div>
              {!j.folga ? (
                <>
                  <div className="col-span-3 md:col-span-2">
                    <label className="text-[10px] text-muted-foreground">Entrada</label>
                    <Input type="time" value={j.ent1 ?? ""} onChange={(e) => update(idx, { ent1: e.target.value })} />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <label className="text-[10px] text-muted-foreground">Saída almoço</label>
                    <Input type="time" value={j.sai1 ?? ""} onChange={(e) => update(idx, { sai1: e.target.value })} />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <label className="text-[10px] text-muted-foreground">Volta almoço</label>
                    <Input type="time" value={j.ent2 ?? ""} onChange={(e) => update(idx, { ent2: e.target.value })} />
                  </div>
                  <div className="col-span-3 md:col-span-1">
                    <label className="text-[10px] text-muted-foreground">Saída</label>
                    <Input type="time" value={j.sai2 ?? ""} onChange={(e) => update(idx, { sai2: e.target.value })} />
                  </div>
                  <div className="col-span-12 md:col-span-1 text-right text-sm">
                    <span className="text-muted-foreground text-xs">Previsto</span>
                    <div className="font-semibold">{calcHoras(j).toFixed(1)}h</div>
                  </div>
                </>
              ) : (
                <div className="col-span-12 md:col-span-10 text-sm text-muted-foreground">Dia de folga (0h)</div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSalvar} disabled={salvar.isPending}>
            {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar jornada
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
