// Parser do input do buscador de OS. Extrai prefixos, atalhos @status e tokens livres.

export interface ParsedSearch {
  tokens: string[];
  osPrefix?: string;
  imeiPrefix?: string;
  telPrefix?: string;
  clientePrefix?: string;
  status?: string;
  raw: string;
}

const STATUS_ALIAS: Record<string, string> = {
  aberta: "aguardando_orcamento",
  orcamento: "aguardando_orcamento",
  aprovacao: "aguardando_aprovacao",
  reparo: "em_reparo",
  peca: "aguardando_peca",
  pecas: "aguardando_peca",
  pronto: "pronto",
  entregue: "entregue",
  cancelada: "cancelado",
  cancelado: "cancelado",
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const PREFIX_REGEX = /\b(os|imei|tel|cliente):([^\s]+)/gi;
const HASH_OS_REGEX = /(?:^|\s)#(\d+)/g;
const STATUS_REGEX = /(?:^|\s)@([a-záéíóúâêôãõç]+)/gi;

export function parseSearch(input: string): ParsedSearch {
  const result: ParsedSearch = { tokens: [], raw: input };
  let leftover = ` ${input} `;

  leftover = leftover.replace(STATUS_REGEX, (_m, alias) => {
    const key = norm(alias);
    if (STATUS_ALIAS[key]) result.status = STATUS_ALIAS[key];
    return " ";
  });

  leftover = leftover.replace(PREFIX_REGEX, (_m, key, value) => {
    const k = key.toLowerCase();
    if (k === "os") result.osPrefix = value;
    else if (k === "imei") result.imeiPrefix = value;
    else if (k === "tel") result.telPrefix = value;
    else if (k === "cliente") result.clientePrefix = value;
    return " ";
  });

  leftover = leftover.replace(HASH_OS_REGEX, (_m, num) => {
    if (!result.osPrefix) result.osPrefix = num;
    return " ";
  });

  result.tokens = leftover
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 6);

  return result;
}
