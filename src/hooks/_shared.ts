// Helpers compartilhados entre hooks do projeto.
//
// `RpcResp<T>`: shape comum de resposta de RPCs JSONB do projeto. Sempre traz
// `success` (true|false) e, em caso de erro, `error` com a mensagem. Os demais
// campos variam por RPC — por isso o índice livre por chave.
//
// `unwrap()`: valida `success !== false` e retorna o data tipado por T.
// Lança `Error(d.error)` quando a RPC reporta falha.

export type RpcResp<T extends Record<string, unknown> = Record<string, never>> =
  { success?: boolean; error?: string } & T & Record<string, unknown>;

export function unwrap<T = Record<string, unknown>>(data: unknown): T {
  const d = (data ?? {}) as RpcResp;
  if (d.success === false) throw new Error(d.error ?? "Erro na RPC");
  return data as T;
}
