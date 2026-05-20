// Catálogo de campos disponíveis para etiquetas
export type CampoTamanho = "pequeno" | "normal" | "grande" | "titulo";
export type CampoAlinhamento = "esquerda" | "centro" | "direita";

export interface CampoConfig {
  id: string;
  label_custom?: string;
  mostrar_label?: boolean;
  tamanho?: CampoTamanho;
  negrito?: boolean;
  alinhamento?: CampoAlinhamento;
}

export interface CampoCatalogo {
  id: string;
  label: string;
  labelPadrao: string;
  grupo: "os" | "peca" | "cliente" | "empresa" | "extra";
  exemplo: string;
}

export const CAMPOS_CATALOGO: CampoCatalogo[] = [
  { id: "logo", label: "Logo da empresa", labelPadrao: "", grupo: "empresa", exemplo: "" },
  { id: "nome_empresa", label: "Nome da empresa", labelPadrao: "", grupo: "empresa", exemplo: "Ditt Software" },
  { id: "os_numero", label: "Número da OS", labelPadrao: "OS", grupo: "os", exemplo: "#000123" },
  { id: "cliente_nome", label: "Cliente (nome)", labelPadrao: "Cliente", grupo: "cliente", exemplo: "João da Silva" },
  { id: "cliente_telefone", label: "Cliente (telefone)", labelPadrao: "Tel", grupo: "cliente", exemplo: "(11) 99999-0000" },
  { id: "aparelho", label: "Aparelho (marca/modelo)", labelPadrao: "Aparelho", grupo: "os", exemplo: "Apple iPhone 13 Preto" },
  { id: "imei", label: "IMEI", labelPadrao: "IMEI", grupo: "os", exemplo: "350123456789012" },
  { id: "defeito", label: "Defeito relatado", labelPadrao: "Defeito", grupo: "os", exemplo: "Tela trincada" },
  { id: "data_entrada", label: "Data de entrada", labelPadrao: "Entrada", grupo: "os", exemplo: "20/05/2026" },
  { id: "previsao_entrega", label: "Previsão de entrega", labelPadrao: "Previsão", grupo: "os", exemplo: "27/05/2026" },
  { id: "tecnico", label: "Técnico responsável", labelPadrao: "Técnico", grupo: "os", exemplo: "Danilo" },
  { id: "valor", label: "Valor estimado", labelPadrao: "Valor", grupo: "os", exemplo: "R$ 350,00" },
  { id: "observacoes", label: "Observações", labelPadrao: "Obs", grupo: "os", exemplo: "Sem capinha" },
  // Peças
  { id: "nome_peca", label: "Nome da peça", labelPadrao: "", grupo: "peca", exemplo: "Tela iPhone 13" },
  { id: "sku", label: "SKU", labelPadrao: "SKU", grupo: "peca", exemplo: "TIP13-001" },
  { id: "preco", label: "Preço", labelPadrao: "Preço", grupo: "peca", exemplo: "R$ 450,00" },
  // Extra
  { id: "texto_livre", label: "Texto livre", labelPadrao: "", grupo: "extra", exemplo: "Garantia 90 dias" },
];

export const labelPadrao = (id: string) =>
  CAMPOS_CATALOGO.find((c) => c.id === id)?.labelPadrao || "";

export const DADOS_EXEMPLO: Record<string, any> = Object.fromEntries(
  CAMPOS_CATALOGO.map((c) => [c.id, c.exemplo])
);
