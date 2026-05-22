UPDATE contas_a_pagar
   SET deleted_at = NULL,
       observacoes = observacoes 
                   || ' | RESTAURADO em 2026-05-22: usado como lembrete operacional de comissões a pagar (DRE filtra Auto-sincronizado, não duplica)'
 WHERE deleted_at IS NOT NULL
   AND categoria = 'Comissões'
   AND data_vencimento >= '2026-04-01' 
   AND data_vencimento <  '2026-05-01'
   AND descricao IN (
     'COMISSÕES DANILO - 2026-04',
     'COMISSÕES HENRIQUE PERRETO - 2026-04',
     'COMISSÕES SAMUEL BR - 2026-04'
   )
   AND observacoes ILIKE '%Auto-sincronizado via trigger%';