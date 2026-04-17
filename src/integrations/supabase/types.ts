export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ajustes_mensais: {
        Row: {
          ano_mes: string
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          ano_mes: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ano_mes?: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "ajustes_mensais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      aparelhos: {
        Row: {
          capacidade: string | null
          capacidade_id: string | null
          cliente_id: string
          cor: string | null
          cor_id: string | null
          created_at: string
          empresa_id: string | null
          id: string
          imei: string | null
          marca: string
          marca_id: string | null
          modelo: string
          modelo_id: string | null
          observacoes: string | null
        }
        Insert: {
          capacidade?: string | null
          capacidade_id?: string | null
          cliente_id: string
          cor?: string | null
          cor_id?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          imei?: string | null
          marca: string
          marca_id?: string | null
          modelo: string
          modelo_id?: string | null
          observacoes?: string | null
        }
        Update: {
          capacidade?: string | null
          capacidade_id?: string | null
          cliente_id?: string
          cor?: string | null
          cor_id?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          imei?: string | null
          marca?: string
          marca_id?: string | null
          modelo?: string
          modelo_id?: string | null
          observacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aparelhos_capacidade_id_fkey"
            columns: ["capacidade_id"]
            isOneToOne: false
            referencedRelation: "capacidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aparelhos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aparelhos_cor_id_fkey"
            columns: ["cor_id"]
            isOneToOne: false
            referencedRelation: "cores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aparelhos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aparelhos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aparelhos_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          created_at: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          empresa_id: string | null
          id: string
          ip: string | null
          modulo: string | null
          registro_id: string | null
          tabela: string | null
          user_id: string | null
          user_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          empresa_id?: string | null
          id?: string
          ip?: string | null
          modulo?: string | null
          registro_id?: string | null
          tabela?: string | null
          user_id?: string | null
          user_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          empresa_id?: string | null
          id?: string
          ip?: string | null
          modulo?: string | null
          registro_id?: string | null
          tabela?: string | null
          user_id?: string | null
          user_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          comentario: string | null
          created_at: string | null
          empresa_id: string | null
          id: string
          nota: number
          ordem_id: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nota: number
          ordem_id: string
        }
        Update: {
          comentario?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          nota?: number
          ordem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_fornecedor: {
        Row: {
          comentario: string | null
          created_at: string | null
          empresa_id: string | null
          fornecedor_id: string
          id: string
          nota_prazo: number | null
          nota_preco: number | null
          nota_qualidade: number | null
          pedido_id: string | null
        }
        Insert: {
          comentario?: string | null
          created_at?: string | null
          empresa_id?: string | null
          fornecedor_id: string
          id?: string
          nota_prazo?: number | null
          nota_preco?: number | null
          nota_qualidade?: number | null
          pedido_id?: string | null
        }
        Update: {
          comentario?: string | null
          created_at?: string | null
          empresa_id?: string | null
          fornecedor_id?: string
          id?: string
          nota_prazo?: number | null
          nota_preco?: number | null
          nota_qualidade?: number | null
          pedido_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_fornecedor_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_fornecedor_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_fornecedor_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      capacidades: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capacidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_sistema: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          tipo: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_sistema_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_custo: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "centros_custo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          deleted_at: string | null
          documento: string | null
          email: string | null
          empresa_id: string | null
          estado: string | null
          id: string
          lojista_id: string | null
          nome: string
          numero_endereco: string | null
          observacoes: string | null
          origem: string | null
          rua: string | null
          status: string
          telefone: string
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          documento?: string | null
          email?: string | null
          empresa_id?: string | null
          estado?: string | null
          id?: string
          lojista_id?: string | null
          nome: string
          numero_endereco?: string | null
          observacoes?: string | null
          origem?: string | null
          rua?: string | null
          status?: string
          telefone: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          deleted_at?: string | null
          documento?: string | null
          email?: string | null
          empresa_id?: string | null
          estado?: string | null
          id?: string
          lojista_id?: string | null
          nome?: string
          numero_endereco?: string | null
          observacoes?: string | null
          origem?: string | null
          rua?: string | null
          status?: string
          telefone?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes: {
        Row: {
          created_at: string
          data_pagamento: string | null
          empresa_id: string | null
          funcionario_id: string
          id: string
          observacoes: string | null
          ordem_id: string | null
          status: Database["public"]["Enums"]["status_comissao"]
          tipo: string | null
          updated_at: string
          valor: number
          valor_base: number | null
        }
        Insert: {
          created_at?: string
          data_pagamento?: string | null
          empresa_id?: string | null
          funcionario_id: string
          id?: string
          observacoes?: string | null
          ordem_id?: string | null
          status?: Database["public"]["Enums"]["status_comissao"]
          tipo?: string | null
          updated_at?: string
          valor?: number
          valor_base?: number | null
        }
        Update: {
          created_at?: string
          data_pagamento?: string | null
          empresa_id?: string | null
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          ordem_id?: string | null
          status?: Database["public"]["Enums"]["status_comissao"]
          tipo?: string | null
          updated_at?: string
          valor?: number
          valor_base?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes_servico: {
        Row: {
          created_at: string
          empresa_id: string | null
          funcionario_id: string
          id: string
          tipo_comissao: Database["public"]["Enums"]["tipo_comissao"]
          tipo_servico_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          funcionario_id: string
          id?: string
          tipo_comissao?: Database["public"]["Enums"]["tipo_comissao"]
          tipo_servico_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          funcionario_id?: string
          id?: string
          tipo_comissao?: Database["public"]["Enums"]["tipo_comissao"]
          tipo_servico_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_servico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_servico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_servico_tipo_servico_id_fkey"
            columns: ["tipo_servico_id"]
            isOneToOne: false
            referencedRelation: "tipos_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      conferencia_itens: {
        Row: {
          conferencia_id: string
          created_at: string
          divergencia: number
          empresa_id: string | null
          estoque_item_id: string | null
          id: string
          item_id: string | null
          item_nome: string
          item_tipo: string
          quantidade_contada: number
          quantidade_esperada: number
          status: string | null
        }
        Insert: {
          conferencia_id: string
          created_at?: string
          divergencia?: number
          empresa_id?: string | null
          estoque_item_id?: string | null
          id?: string
          item_id?: string | null
          item_nome: string
          item_tipo: string
          quantidade_contada?: number
          quantidade_esperada?: number
          status?: string | null
        }
        Update: {
          conferencia_id?: string
          created_at?: string
          divergencia?: number
          empresa_id?: string | null
          estoque_item_id?: string | null
          id?: string
          item_id?: string | null
          item_nome?: string
          item_tipo?: string
          quantidade_contada?: number
          quantidade_esperada?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conferencia_itens_conferencia_id_fkey"
            columns: ["conferencia_id"]
            isOneToOne: false
            referencedRelation: "conferencias_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencia_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencia_itens_estoque_item_id_fkey"
            columns: ["estoque_item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      conferencias_estoque: {
        Row: {
          created_at: string
          data: string
          data_fim: string | null
          data_inicio: string | null
          detalhes: Json
          empresa_id: string | null
          id: string
          observacoes: string | null
          responsavel: string
          status: Database["public"]["Enums"]["status_conferencia"]
          tipo: string
          tipo_conferencia: string | null
          total_conferido: number
          total_divergencias: number
          total_esperado: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data?: string
          data_fim?: string | null
          data_inicio?: string | null
          detalhes?: Json
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          responsavel: string
          status?: Database["public"]["Enums"]["status_conferencia"]
          tipo?: string
          tipo_conferencia?: string | null
          total_conferido?: number
          total_divergencias?: number
          total_esperado?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          data_fim?: string | null
          data_inicio?: string | null
          detalhes?: Json
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          responsavel?: string
          status?: Database["public"]["Enums"]["status_conferencia"]
          tipo?: string
          tipo_conferencia?: string | null
          total_conferido?: number
          total_divergencias?: number
          total_esperado?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conferencias_estoque_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_a_pagar: {
        Row: {
          categoria: string
          categoria_financeira_id: string | null
          centro_custo: string | null
          centro_custo_id: string | null
          created_at: string
          created_by: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          empresa_id: string | null
          fornecedor: string | null
          fornecedor_id: string | null
          id: string
          loja_id: string | null
          observacoes: string | null
          ordem_servico_id: string | null
          recorrente: boolean
          status: Database["public"]["Enums"]["status_conta"]
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string
          categoria_financeira_id?: string | null
          centro_custo?: string | null
          centro_custo_id?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          empresa_id?: string | null
          fornecedor?: string | null
          fornecedor_id?: string | null
          id?: string
          loja_id?: string | null
          observacoes?: string | null
          ordem_servico_id?: string | null
          recorrente?: boolean
          status?: Database["public"]["Enums"]["status_conta"]
          updated_at?: string
          valor: number
        }
        Update: {
          categoria?: string
          categoria_financeira_id?: string | null
          centro_custo?: string | null
          centro_custo_id?: string | null
          created_at?: string
          created_by?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          empresa_id?: string | null
          fornecedor?: string | null
          fornecedor_id?: string | null
          id?: string
          loja_id?: string | null
          observacoes?: string | null
          ordem_servico_id?: string | null
          recorrente?: boolean
          status?: Database["public"]["Enums"]["status_conta"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_a_pagar_categoria_financeira_id_fkey"
            columns: ["categoria_financeira_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_a_pagar_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_a_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_a_pagar_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_a_pagar_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_a_pagar_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      cores: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          hex: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          hex?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          hex?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      empresa_config: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj_cpf: string | null
          complemento: string | null
          cor_principal: string | null
          created_at: string
          depreciacao_mensal: number | null
          dias_garantia: number | null
          email: string | null
          empresa_id: string | null
          endereco: string | null
          estado: string | null
          formato_data: string | null
          gastos_fixos_mensais: number | null
          horario_funcionamento: string | null
          id: string
          impostos_mensal: number | null
          logo_url: string | null
          meta_faturamento_mes: number | null
          meta_gastos_mes: number | null
          moeda: string | null
          nome: string
          numero: string | null
          numero_socios: number | null
          observacoes: string | null
          outros_gastos: number | null
          percentual_reserva_empresa: number | null
          rua: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          complemento?: string | null
          cor_principal?: string | null
          created_at?: string
          depreciacao_mensal?: number | null
          dias_garantia?: number | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          formato_data?: string | null
          gastos_fixos_mensais?: number | null
          horario_funcionamento?: string | null
          id?: string
          impostos_mensal?: number | null
          logo_url?: string | null
          meta_faturamento_mes?: number | null
          meta_gastos_mes?: number | null
          moeda?: string | null
          nome?: string
          numero?: string | null
          numero_socios?: number | null
          observacoes?: string | null
          outros_gastos?: number | null
          percentual_reserva_empresa?: number | null
          rua?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj_cpf?: string | null
          complemento?: string | null
          cor_principal?: string | null
          created_at?: string
          depreciacao_mensal?: number | null
          dias_garantia?: number | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          formato_data?: string | null
          gastos_fixos_mensais?: number | null
          horario_funcionamento?: string | null
          id?: string
          impostos_mensal?: number | null
          logo_url?: string | null
          meta_faturamento_mes?: number | null
          meta_gastos_mes?: number | null
          moeda?: string | null
          nome?: string
          numero?: string | null
          numero_socios?: number | null
          observacoes?: string | null
          outros_gastos?: number | null
          percentual_reserva_empresa?: number | null
          rua?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          criado_em: string | null
          email: string | null
          endereco: Json | null
          estado: string | null
          id: string
          logo_url: string | null
          nome: string
          numero: string | null
          owner_id: string
          plano: string
          plano_ativo: boolean
          rua: string | null
          slug: string
          telefone: string | null
          trial_expira_em: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          criado_em?: string | null
          email?: string | null
          endereco?: Json | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          numero?: string | null
          owner_id: string
          plano?: string
          plano_ativo?: boolean
          rua?: string | null
          slug: string
          telefone?: string | null
          trial_expira_em?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          criado_em?: string | null
          email?: string | null
          endereco?: Json | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          numero?: string | null
          owner_id?: string
          plano?: string
          plano_ativo?: boolean
          rua?: string | null
          slug?: string
          telefone?: string | null
          trial_expira_em?: string | null
        }
        Relationships: []
      }
      entradas_estoque: {
        Row: {
          created_at: string
          data_compra: string
          empresa_id: string | null
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          numero_nota: string | null
          observacoes: string | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string
          data_compra?: string
          empresa_id?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          numero_nota?: string | null
          observacoes?: string | null
          valor_total?: number | null
        }
        Update: {
          created_at?: string
          data_compra?: string
          empresa_id?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          numero_nota?: string | null
          observacoes?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entradas_estoque_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entradas_estoque_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      entradas_estoque_itens: {
        Row: {
          created_at: string
          custo_unitario: number
          empresa_id: string | null
          entrada_id: string
          estoque_item_id: string
          id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          custo_unitario: number
          empresa_id?: string | null
          entrada_id: string
          estoque_item_id: string
          id?: string
          quantidade: number
        }
        Update: {
          created_at?: string
          custo_unitario?: number
          empresa_id?: string | null
          entrada_id?: string
          estoque_item_id?: string
          id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "entradas_estoque_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entradas_estoque_itens_entrada_id_fkey"
            columns: ["entrada_id"]
            isOneToOne: false
            referencedRelation: "entradas_estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entradas_estoque_itens_estoque_item_id_fkey"
            columns: ["estoque_item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque: {
        Row: {
          categoria: string | null
          created_at: string
          empresa_id: string | null
          fornecedor: string | null
          id: string
          nome: string
          preco_custo: number | null
          preco_venda: number | null
          quantidade: number
          quantidade_minima: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          empresa_id?: string | null
          fornecedor?: string | null
          id?: string
          nome: string
          preco_custo?: number | null
          preco_venda?: number | null
          quantidade?: number
          quantidade_minima?: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          empresa_id?: string | null
          fornecedor?: string | null
          id?: string
          nome?: string
          preco_custo?: number | null
          preco_venda?: number | null
          quantidade?: number
          quantidade_minima?: number
        }
        Relationships: [
          {
            foreignKeyName: "estoque_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_aparelhos: {
        Row: {
          capacidade: string | null
          cor: string | null
          created_at: string
          custo_compra: number | null
          data_entrada: string
          empresa_id: string | null
          fornecedor: string | null
          id: string
          imei: string | null
          localizacao: string | null
          marca: string
          modelo: string
          observacoes: string | null
          status: Database["public"]["Enums"]["status_estoque_aparelho"]
        }
        Insert: {
          capacidade?: string | null
          cor?: string | null
          created_at?: string
          custo_compra?: number | null
          data_entrada?: string
          empresa_id?: string | null
          fornecedor?: string | null
          id?: string
          imei?: string | null
          localizacao?: string | null
          marca: string
          modelo: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_estoque_aparelho"]
        }
        Update: {
          capacidade?: string | null
          cor?: string | null
          created_at?: string
          custo_compra?: number | null
          data_entrada?: string
          empresa_id?: string | null
          fornecedor?: string | null
          id?: string
          imei?: string | null
          localizacao?: string | null
          marca?: string
          modelo?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_estoque_aparelho"]
        }
        Relationships: [
          {
            foreignKeyName: "estoque_aparelhos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_categorias: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_itens: {
        Row: {
          capacidade: string | null
          categoria_id: string | null
          codigo_barras: string | null
          cor: string | null
          created_at: string
          custo_unitario: number | null
          deleted_at: string | null
          empresa_id: string | null
          fornecedor: string | null
          id: string
          imei_serial: string | null
          local_estoque: string | null
          marca_id: string | null
          modelo_id: string | null
          nome_personalizado: string | null
          observacoes: string | null
          preco_venda: number | null
          quantidade: number
          quantidade_minima: number
          sku: string | null
          status: string
          tipo_item: string
          updated_at: string
        }
        Insert: {
          capacidade?: string | null
          categoria_id?: string | null
          codigo_barras?: string | null
          cor?: string | null
          created_at?: string
          custo_unitario?: number | null
          deleted_at?: string | null
          empresa_id?: string | null
          fornecedor?: string | null
          id?: string
          imei_serial?: string | null
          local_estoque?: string | null
          marca_id?: string | null
          modelo_id?: string | null
          nome_personalizado?: string | null
          observacoes?: string | null
          preco_venda?: number | null
          quantidade?: number
          quantidade_minima?: number
          sku?: string | null
          status?: string
          tipo_item?: string
          updated_at?: string
        }
        Update: {
          capacidade?: string | null
          categoria_id?: string | null
          codigo_barras?: string | null
          cor?: string | null
          created_at?: string
          custo_unitario?: number | null
          deleted_at?: string | null
          empresa_id?: string | null
          fornecedor?: string | null
          id?: string
          imei_serial?: string | null
          local_estoque?: string | null
          marca_id?: string | null
          modelo_id?: string | null
          nome_personalizado?: string | null
          observacoes?: string | null
          preco_venda?: number | null
          quantidade?: number
          quantidade_minima?: number
          sku?: string | null
          status?: string
          tipo_item?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_itens_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "estoque_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_itens_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_itens_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_movimentos: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          motivo: string | null
          os_id: string | null
          peca_id: string
          pecas_utilizadas_id: string | null
          quantidade: number
          tipo: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          motivo?: string | null
          os_id?: string | null
          peca_id: string
          pecas_utilizadas_id?: string | null
          quantidade: number
          tipo: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          motivo?: string | null
          os_id?: string | null
          peca_id?: string
          pecas_utilizadas_id?: string | null
          quantidade?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentos_os_id_fkey"
            columns: ["os_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentos_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentos_pecas_utilizadas_id_fkey"
            columns: ["pecas_utilizadas_id"]
            isOneToOne: false
            referencedRelation: "pecas_utilizadas"
            referencedColumns: ["id"]
          },
        ]
      }
      formas_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formas_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          categoria: string | null
          cnpj_cpf: string | null
          created_at: string
          email: string | null
          empresa_id: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          prazo_medio: string | null
          responsavel: string | null
          telefone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          prazo_medio?: string | null
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          prazo_medio?: string | null
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          ativo: boolean
          bairro: string | null
          carga_horaria: string | null
          cargo: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          data_admissao: string | null
          deleted_at: string | null
          email: string | null
          empresa_id: string | null
          endereco: string | null
          especialidade: string | null
          estado: string | null
          funcao: string | null
          id: string
          nome: string
          numero: string | null
          observacoes: string | null
          salario_fixo: number | null
          telefone: string | null
          tipo_comissao: Database["public"]["Enums"]["tipo_comissao"]
          vale_alimentacao: number | null
          vale_transporte: number | null
          valor_comissao: number
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          carga_horaria?: string | null
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          especialidade?: string | null
          estado?: string | null
          funcao?: string | null
          id?: string
          nome: string
          numero?: string | null
          observacoes?: string | null
          salario_fixo?: number | null
          telefone?: string | null
          tipo_comissao?: Database["public"]["Enums"]["tipo_comissao"]
          vale_alimentacao?: number | null
          vale_transporte?: number | null
          valor_comissao?: number
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          carga_horaria?: string | null
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          especialidade?: string | null
          estado?: string | null
          funcao?: string | null
          id?: string
          nome?: string
          numero?: string | null
          observacoes?: string | null
          salario_fixo?: number | null
          telefone?: string | null
          tipo_comissao?: Database["public"]["Enums"]["tipo_comissao"]
          vale_alimentacao?: number | null
          vale_transporte?: number | null
          valor_comissao?: number
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      garantias: {
        Row: {
          created_at: string | null
          data_fim: string
          data_inicio: string
          dias_garantia: number
          empresa_id: string | null
          id: string
          observacoes: string | null
          ordem_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          data_fim: string
          data_inicio: string
          dias_garantia?: number
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          ordem_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          dias_garantia?: number
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          ordem_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "garantias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garantias_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_ordens: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          observacao: string | null
          ordem_id: string
          status_anterior: string | null
          status_novo: string
          usuario_responsavel: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          observacao?: string | null
          ordem_id: string
          status_anterior?: string | null
          status_novo: string
          usuario_responsavel?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          observacao?: string | null
          ordem_id?: string
          status_anterior?: string | null
          status_novo?: string
          usuario_responsavel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_ordens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_ordens_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      imei_device_cache: {
        Row: {
          capacidade: string | null
          cor: string | null
          created_at: string
          empresa_id: string | null
          fonte: string
          id: string
          marca: string
          modelo: string
          tac: string
          updated_at: string
          vezes_usado: number
        }
        Insert: {
          capacidade?: string | null
          cor?: string | null
          created_at?: string
          empresa_id?: string | null
          fonte?: string
          id?: string
          marca: string
          modelo: string
          tac: string
          updated_at?: string
          vezes_usado?: number
        }
        Update: {
          capacidade?: string | null
          cor?: string | null
          created_at?: string
          empresa_id?: string | null
          fonte?: string
          id?: string
          marca?: string
          modelo?: string
          tac?: string
          updated_at?: string
          vezes_usado?: number
        }
        Relationships: [
          {
            foreignKeyName: "imei_device_cache_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      listas_preco: {
        Row: {
          ativo: boolean
          cliente_id: string | null
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cliente_id?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cliente_id?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listas_preco_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listas_preco_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      listas_preco_itens: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          lista_id: string
          nome_item: string
          observacoes: string | null
          preco_especial: number | null
          preco_padrao: number | null
          referencia_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          lista_id: string
          nome_item: string
          observacoes?: string | null
          preco_especial?: number | null
          preco_padrao?: number | null
          referencia_id?: string | null
          tipo?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          lista_id?: string
          nome_item?: string
          observacoes?: string | null
          preco_especial?: number | null
          preco_padrao?: number | null
          referencia_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "listas_preco_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listas_preco_itens_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "listas_preco"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          ativo: boolean
          cidade: string | null
          cliente_id: string
          created_at: string
          deleted_at: string | null
          email: string | null
          empresa_id: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          observacoes: string | null
          responsavel: string | null
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          cliente_id: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          responsavel?: string | null
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          cliente_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          responsavel?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lojas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lojas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      lojista_usuarios: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          email: string
          id: string
          lojista_id: string
          nome: string
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          lojista_id: string
          nome: string
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          lojista_id?: string
          nome?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lojista_usuarios_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
            referencedColumns: ["id"]
          },
        ]
      }
      lojistas: {
        Row: {
          ativo: boolean | null
          cnpj: string | null
          convite_aceito_em: string | null
          convite_enviado_em: string | null
          convite_token: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          empresa_id: string | null
          id: string
          nome: string
          observacoes: string | null
          razao_social: string | null
          responsavel: string | null
          status_acesso: string
          telefone: string | null
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean | null
          cnpj?: string | null
          convite_aceito_em?: string | null
          convite_enviado_em?: string | null
          convite_token?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          razao_social?: string | null
          responsavel?: string | null
          status_acesso?: string
          telefone?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean | null
          cnpj?: string | null
          convite_aceito_em?: string | null
          convite_enviado_em?: string | null
          convite_token?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          razao_social?: string | null
          responsavel?: string | null
          status_acesso?: string
          telefone?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lojistas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      marcas: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marcas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          created_at: string
          empresa_id: string | null
          id: string
          marca_id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          marca_id: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          marca_id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "estoque_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelos_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos_documento: {
        Row: {
          ativo: boolean
          cabecalho: string | null
          corpo: string | null
          created_at: string
          empresa_id: string | null
          id: string
          observacoes: string | null
          rodape: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cabecalho?: string | null
          corpo?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          rodape?: string | null
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cabecalho?: string | null
          corpo?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          rodape?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelos_documento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_financeiras: {
        Row: {
          created_at: string
          data: string
          descricao: string
          empresa_id: string | null
          estoque_id: string | null
          id: string
          ordem_id: string | null
          tipo: Database["public"]["Enums"]["tipo_movimentacao"]
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          descricao: string
          empresa_id?: string | null
          estoque_id?: string | null
          id?: string
          ordem_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimentacao"]
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          empresa_id?: string | null
          estoque_id?: string | null
          id?: string
          ordem_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimentacao"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_financeiras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_financeiras_estoque_id_fkey"
            columns: ["estoque_id"]
            isOneToOne: false
            referencedRelation: "estoque"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_financeiras_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string | null
          empresa_id: string | null
          id: string
          lida: boolean
          mensagem: string
          referencia_id: string | null
          referencia_tabela: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          lida?: boolean
          mensagem: string
          referencia_id?: string | null
          referencia_tabela?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          lida?: boolean
          mensagem?: string
          referencia_id?: string | null
          referencia_tabela?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_de_servico: {
        Row: {
          aparelho_id: string
          aprovacao_orcamento: string | null
          aprovado_no_ato: boolean | null
          bateria_entrada: number | null
          checklist_entrada: Json | null
          contato_preferido: string | null
          created_at: string
          created_by: string | null
          custo_pecas: number | null
          custo_total: number | null
          data_aprovacao: string | null
          data_conclusao: string | null
          data_entrada: string
          data_entrega: string | null
          defeito_relatado: string
          deleted_at: string | null
          desconto: number
          diagnostico: string | null
          empresa_id: string | null
          estado_geral: string | null
          forma_pagamento_id: string | null
          forma_pagamento_sinal: string | null
          funcionario_id: string | null
          garantia_dias: number
          id: string
          imei2: string | null
          liga: string | null
          loja_id: string | null
          lojista_id: string | null
          lucro_bruto: number | null
          mao_obra_adicional: number
          motivo_reprovacao: string | null
          numero: number
          numero_formatado: string | null
          obs_cliente: string | null
          observacoes: string | null
          orcamento_aprovado_em: string | null
          os_origem_id: string | null
          prazo_vencido: boolean
          previsao_entrega: string | null
          prioridade: string
          referencia_lote: string | null
          relato_cliente: string | null
          retrabalho: boolean
          servico_realizado: string | null
          sinal_pago: number
          status: Database["public"]["Enums"]["status_ordem"]
          tecnico: string | null
          tipo_servico_id: string | null
          updated_at: string
          updated_by: string | null
          valor: number | null
          valor_pago: number | null
          valor_pendente: number | null
          valor_total: number | null
        }
        Insert: {
          aparelho_id: string
          aprovacao_orcamento?: string | null
          aprovado_no_ato?: boolean | null
          bateria_entrada?: number | null
          checklist_entrada?: Json | null
          contato_preferido?: string | null
          created_at?: string
          created_by?: string | null
          custo_pecas?: number | null
          custo_total?: number | null
          data_aprovacao?: string | null
          data_conclusao?: string | null
          data_entrada?: string
          data_entrega?: string | null
          defeito_relatado: string
          deleted_at?: string | null
          desconto?: number
          diagnostico?: string | null
          empresa_id?: string | null
          estado_geral?: string | null
          forma_pagamento_id?: string | null
          forma_pagamento_sinal?: string | null
          funcionario_id?: string | null
          garantia_dias?: number
          id?: string
          imei2?: string | null
          liga?: string | null
          loja_id?: string | null
          lojista_id?: string | null
          lucro_bruto?: number | null
          mao_obra_adicional?: number
          motivo_reprovacao?: string | null
          numero?: number
          numero_formatado?: string | null
          obs_cliente?: string | null
          observacoes?: string | null
          orcamento_aprovado_em?: string | null
          os_origem_id?: string | null
          prazo_vencido?: boolean
          previsao_entrega?: string | null
          prioridade?: string
          referencia_lote?: string | null
          relato_cliente?: string | null
          retrabalho?: boolean
          servico_realizado?: string | null
          sinal_pago?: number
          status?: Database["public"]["Enums"]["status_ordem"]
          tecnico?: string | null
          tipo_servico_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: number | null
          valor_pago?: number | null
          valor_pendente?: number | null
          valor_total?: number | null
        }
        Update: {
          aparelho_id?: string
          aprovacao_orcamento?: string | null
          aprovado_no_ato?: boolean | null
          bateria_entrada?: number | null
          checklist_entrada?: Json | null
          contato_preferido?: string | null
          created_at?: string
          created_by?: string | null
          custo_pecas?: number | null
          custo_total?: number | null
          data_aprovacao?: string | null
          data_conclusao?: string | null
          data_entrada?: string
          data_entrega?: string | null
          defeito_relatado?: string
          deleted_at?: string | null
          desconto?: number
          diagnostico?: string | null
          empresa_id?: string | null
          estado_geral?: string | null
          forma_pagamento_id?: string | null
          forma_pagamento_sinal?: string | null
          funcionario_id?: string | null
          garantia_dias?: number
          id?: string
          imei2?: string | null
          liga?: string | null
          loja_id?: string | null
          lojista_id?: string | null
          lucro_bruto?: number | null
          mao_obra_adicional?: number
          motivo_reprovacao?: string | null
          numero?: number
          numero_formatado?: string | null
          obs_cliente?: string | null
          observacoes?: string | null
          orcamento_aprovado_em?: string | null
          os_origem_id?: string | null
          prazo_vencido?: boolean
          previsao_entrega?: string | null
          prioridade?: string
          referencia_lote?: string | null
          relato_cliente?: string | null
          retrabalho?: boolean
          servico_realizado?: string | null
          sinal_pago?: number
          status?: Database["public"]["Enums"]["status_ordem"]
          tecnico?: string | null
          tipo_servico_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: number | null
          valor_pago?: number | null
          valor_pendente?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_de_servico_aparelho_id_fkey"
            columns: ["aparelho_id"]
            isOneToOne: false
            referencedRelation: "aparelhos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_de_servico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_de_servico_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_de_servico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_de_servico_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_de_servico_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_de_servico_os_origem_id_fkey"
            columns: ["os_origem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_de_servico_tipo_servico_id_fkey"
            columns: ["tipo_servico_id"]
            isOneToOne: false
            referencedRelation: "tipos_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_servicos: {
        Row: {
          categoria: string | null
          comissao: number
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          ordem_id: string
          servico_id: string | null
          valor: number
        }
        Insert: {
          categoria?: string | null
          comissao?: number
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          ordem_id: string
          servico_id?: string | null
          valor?: number
        }
        Update: {
          categoria?: string | null
          comissao?: number
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          ordem_id?: string
          servico_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "os_servicos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_servicos_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_servicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "tipos_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      pecas_utilizadas: {
        Row: {
          created_at: string
          custo_unitario: number
          empresa_id: string | null
          id: string
          ordem_id: string
          origem_servico_id: string | null
          peca_id: string
          preco_unitario: number
          quantidade: number
        }
        Insert: {
          created_at?: string
          custo_unitario?: number
          empresa_id?: string | null
          id?: string
          ordem_id: string
          origem_servico_id?: string | null
          peca_id: string
          preco_unitario?: number
          quantidade?: number
        }
        Update: {
          created_at?: string
          custo_unitario?: number
          empresa_id?: string | null
          id?: string
          ordem_id?: string
          origem_servico_id?: string | null
          peca_id?: string
          preco_unitario?: number
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "pecas_utilizadas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pecas_utilizadas_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pecas_utilizadas_origem_servico_id_fkey"
            columns: ["origem_servico_id"]
            isOneToOne: false
            referencedRelation: "tipos_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pecas_utilizadas_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_compra: {
        Row: {
          created_at: string | null
          created_by: string | null
          data_pedido: string
          data_previsao: string | null
          data_recebimento: string | null
          empresa_id: string | null
          fornecedor_id: string
          id: string
          observacoes: string | null
          status: string
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data_pedido?: string
          data_previsao?: string | null
          data_recebimento?: string | null
          empresa_id?: string | null
          fornecedor_id: string
          id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data_pedido?: string
          data_previsao?: string | null
          data_recebimento?: string | null
          empresa_id?: string | null
          fornecedor_id?: string
          id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_compra_itens: {
        Row: {
          created_at: string | null
          custo_unitario: number
          empresa_id: string | null
          estoque_item_id: string | null
          id: string
          nome_item: string
          pedido_id: string
          quantidade: number
          quantidade_recebida: number | null
        }
        Insert: {
          created_at?: string | null
          custo_unitario?: number
          empresa_id?: string | null
          estoque_item_id?: string | null
          id?: string
          nome_item: string
          pedido_id: string
          quantidade?: number
          quantidade_recebida?: number | null
        }
        Update: {
          created_at?: string | null
          custo_unitario?: number
          empresa_id?: string | null
          estoque_item_id?: string | null
          id?: string
          nome_item?: string
          pedido_id?: string
          quantidade?: number
          quantidade_recebida?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_itens_estoque_item_id_fkey"
            columns: ["estoque_item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_acesso: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          nome_perfil: string
          permissoes: Json
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome_perfil: string
          permissoes?: Json
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome_perfil?: string
          permissoes?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_acesso_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_base: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          created_at: string
          custo: number | null
          descricao: string | null
          empresa_id: string | null
          id: string
          marca_id: string | null
          modelo_id: string | null
          nome: string
          preco_especial: number | null
          preco_padrao: number | null
          sku: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          custo?: number | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          marca_id?: string | null
          modelo_id?: string | null
          nome: string
          preco_especial?: number | null
          preco_padrao?: number | null
          sku?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          custo?: number | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          marca_id?: string | null
          modelo_id?: string | null
          nome?: string
          preco_especial?: number | null
          preco_padrao?: number | null
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_base_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "estoque_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_base_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_base_marca_id_fkey"
            columns: ["marca_id"]
            isOneToOne: false
            referencedRelation: "marcas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_base_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      recebimentos: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_recebimento: string
          descricao: string
          empresa_id: string | null
          forma_pagamento: string
          id: string
          loja_id: string | null
          observacoes: string | null
          ordem_servico_id: string | null
          valor: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_recebimento: string
          descricao: string
          empresa_id?: string | null
          forma_pagamento?: string
          id?: string
          loja_id?: string | null
          observacoes?: string | null
          ordem_servico_id?: string | null
          valor: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_recebimento?: string
          descricao?: string
          empresa_id?: string | null
          forma_pagamento?: string
          id?: string
          loja_id?: string | null
          observacoes?: string | null
          ordem_servico_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      servico_pecas: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          obrigatoria: boolean
          peca_id: string
          quantidade: number
          servico_id: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          obrigatoria?: boolean
          peca_id: string
          quantidade?: number
          servico_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          obrigatoria?: boolean
          peca_id?: string
          quantidade?: number
          servico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "servico_pecas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servico_pecas_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servico_pecas_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "tipos_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      socios: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "socios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      status_ordem_servico: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          ordem_exibicao: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          ordem_exibicao?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          ordem_exibicao?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_ordem_servico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      templates_mensagem: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          evento: string
          id: string
          mensagem: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          evento: string
          id?: string
          mensagem: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          evento?: string
          id?: string
          mensagem?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_mensagem_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_servico: {
        Row: {
          ativo: boolean
          categoria: string | null
          comissao_padrao: number | null
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          updated_at: string
          valor_padrao: number | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          comissao_padrao?: number | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          updated_at?: string
          valor_padrao?: number | null
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          comissao_padrao?: number | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
          valor_padrao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tipos_servico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          funcionario_id: string | null
          id: string
          nome_exibicao: string | null
          perfil_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          funcionario_id?: string | null
          id?: string
          nome_exibicao?: string | null
          perfil_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          funcionario_id?: string | null
          id?: string
          nome_exibicao?: string | null
          perfil_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_demo_user: {
        Args: { p_email: string; p_user_id: string }
        Returns: undefined
      }
      get_clientes_com_stats: {
        Args: never
        Returns: {
          cpf: string
          created_at: string
          email: string
          id: string
          nome: string
          observacoes: string
          telefone: string
          total_gasto: number
          total_os: number
          ultimo_atendimento: string
          whatsapp: string
        }[]
      }
      get_dashboard_summary: { Args: never; Returns: Json }
      get_my_empresa_id: { Args: never; Returns: string }
      get_my_lojista_id: { Args: never; Returns: string }
      is_admin_user: { Args: { _user_id: string }; Returns: boolean }
      is_internal_user: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalcular_totais_os: { Args: { p_ordem_id: string }; Returns: undefined }
    }
    Enums: {
      status_comissao: "pendente" | "liberada" | "paga"
      status_conferencia: "em_andamento" | "finalizada"
      status_conta: "pendente" | "paga" | "vencida" | "cancelada"
      status_estoque_aparelho:
        | "disponivel"
        | "em_assistencia"
        | "em_transporte"
        | "vendido"
      status_ordem:
        | "recebido"
        | "em_analise"
        | "aguardando_aprovacao"
        | "aprovado"
        | "em_reparo"
        | "aguardando_peca"
        | "pronto"
        | "entregue"
      tipo_comissao: "fixa" | "percentual"
      tipo_movimentacao: "entrada" | "saida"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      status_comissao: ["pendente", "liberada", "paga"],
      status_conferencia: ["em_andamento", "finalizada"],
      status_conta: ["pendente", "paga", "vencida", "cancelada"],
      status_estoque_aparelho: [
        "disponivel",
        "em_assistencia",
        "em_transporte",
        "vendido",
      ],
      status_ordem: [
        "recebido",
        "em_analise",
        "aguardando_aprovacao",
        "aprovado",
        "em_reparo",
        "aguardando_peca",
        "pronto",
        "entregue",
      ],
      tipo_comissao: ["fixa", "percentual"],
      tipo_movimentacao: ["entrada", "saida"],
    },
  },
} as const
