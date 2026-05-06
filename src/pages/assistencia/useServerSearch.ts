import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseSearch, type ParsedSearch } from "./searchParser";

export function useServerSearch(rawInput: string, empresaId: string | undefined, debounceMs = 300) {
  const [debounced, setDebounced] = useState(rawInput);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(rawInput), debounceMs);
    return () => clearTimeout(t);
  }, [rawInput, debounceMs]);

  const parsed = useMemo<ParsedSearch>(() => parseSearch(debounced), [debounced]);
  const isEmpty =
    parsed.tokens.length === 0 &&
    !parsed.osPrefix && !parsed.imeiPrefix && !parsed.telPrefix &&
    !parsed.clientePrefix && !parsed.status;

  const query = useQuery({
    queryKey: ["buscar-os-inteligente", empresaId, parsed],
    enabled: !!empresaId && !isEmpty,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("buscar_ordens_servico" as any, {
        p_empresa_id: empresaId!,
        p_tokens: parsed.tokens,
        p_os_prefix: parsed.osPrefix ?? null,
        p_imei_prefix: parsed.imeiPrefix ?? null,
        p_tel_prefix: parsed.telPrefix ?? null,
        p_cliente_prefix: parsed.clientePrefix ?? null,
        p_status: parsed.status ?? null,
        p_limit: 500,
      });
      if (error) throw error;
      return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
    },
  });

  return {
    parsed,
    isEmpty,
    matchingIds: (isEmpty ? null : (query.data ?? null)) as string[] | null,
    isLoading: query.isLoading && !isEmpty,
  };
}
