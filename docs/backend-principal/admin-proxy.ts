// Cópia de referência da edge function `admin-proxy` deployada no backend
// principal (projeto Supabase cgsdnvuigolxwzfmnykk). Fonte de verdade:
// supabase/functions/admin-proxy/index.ts neste repositório.
//
// Como usar no painel ditt-admin:
//   POST https://cgsdnvuigolxwzfmnykk.supabase.co/functions/v1/admin-proxy
//   Headers:
//     Content-Type: application/json
//     x-admin-panel-secret: <VITE_ADMIN_PANEL_SECRET>
//   Body:
//     { "fn": "kpis_dashboard", "args": {} }
//     { "fn": "listar_empresas", "args": { "p_status": null, "p_busca": null } }
//     { "fn": "detalhe_empresa", "args": { "p_empresa_id": "<uuid>" } }
//     { "fn": "atividade_recente", "args": { "p_limit": 20 } }
//     { "fn": "mrr_serie_12m", "args": {} }
//     { "fn": "criar_nota", "args": { "p_empresa_id": "<uuid>", "p_texto": "..." } }
//
// Resposta: { "data": <resultado do RPC> } em caso de sucesso,
//           { "error": "<mensagem>" } em caso de erro (401/400/500).

export {}; // arquivo apenas para referência
