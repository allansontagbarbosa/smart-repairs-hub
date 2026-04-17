// Stopwords pt-br comuns (artigos, preposições, conjunções, pronomes)
const STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "uns", "umas",
  "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas",
  "para", "pra", "por", "pelo", "pela", "com", "sem", "sob", "sobre",
  "e", "ou", "mas", "que", "se", "como", "quando", "onde", "porque",
  "eu", "tu", "ele", "ela", "nos", "vos", "eles", "elas",
  "meu", "teu", "seu", "sua", "minha", "tua",
  "este", "esta", "isso", "isto", "esse", "essa", "aquele", "aquela",
  "muito", "muita", "pouco", "pouca", "mais", "menos", "tao",
  "ja", "nao", "sim", "talvez",
  "ser", "estar", "ter", "haver", "fazer", "ir", "vir",
  "foi", "esta", "tem", "vai", "veio",
  "ficou", "deu", "ta", "tava", "to",
]);

/** Remove acentos e lowercases */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Extrai palavras-chave do relato (sem stopwords, mín 3 letras) */
export function extractKeywords(relato: string): string[] {
  if (!relato) return [];
  const words = normalize(relato)
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return Array.from(new Set(words));
}

interface ServicoMatch<T> {
  servico: T;
  score: number;
}

/**
 * Busca fuzzy serviços por palavras-chave do relato.
 * Boost extra se o nome do serviço contém marca/modelo do aparelho.
 */
export function suggestServicos<T extends { id: string; nome: string }>(
  relato: string,
  servicos: T[],
  opts: { marca?: string; modelo?: string; excluirIds?: Set<string>; topN?: number } = {}
): T[] {
  const { marca, modelo, excluirIds, topN = 3 } = opts;
  const keywords = extractKeywords(relato);
  if (keywords.length === 0) return [];

  const marcaNorm = marca ? normalize(marca) : "";
  const modeloNorm = modelo ? normalize(modelo) : "";

  const matches: ServicoMatch<T>[] = [];

  for (const s of servicos) {
    if (excluirIds?.has(s.id)) continue;
    const nomeNorm = normalize(s.nome);
    let score = 0;

    for (const kw of keywords) {
      if (nomeNorm.includes(kw)) score += 1;
    }

    if (score === 0) continue;

    // Boost se o serviço cita a marca/modelo do aparelho
    if (marcaNorm && nomeNorm.includes(marcaNorm)) score += 0.5;
    if (modeloNorm && nomeNorm.includes(modeloNorm)) score += 1.5;

    matches.push({ servico: s, score });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, topN).map((m) => m.servico);
}
