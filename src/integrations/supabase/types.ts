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
      assinaturas_digitais: {
        Row: {
          assinatura_base64: string
          created_at: string
          empresa_id: string
          id: string
          ip_address: string | null
          ordem_id: string
          signatario_nome: string
          signatario_user_id: string | null
          tipo: string
          user_agent: string | null
        }
        Insert: {
          assinatura_base64: string
          created_at?: string
          empresa_id: string
          id?: string
          ip_address?: string | null
          ordem_id: string
          signatario_nome: string
          signatario_user_id?: string | null
          tipo: string
          user_agent?: string | null
        }
        Update: {
          assinatura_base64?: string
          created_at?: string
          empresa_id?: string
          id?: string
          ip_address?: string | null
          ordem_id?: string
          signatario_nome?: string
          signatario_user_id?: string | null
          tipo?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_digitais_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
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
      auditoria_falhas: {
        Row: {
          acao: string | null
          created_at: string
          empresa_id: string | null
          erro: string | null
          id: string
          modulo: string | null
          registro_id: string | null
          user_id: string | null
        }
        Insert: {
          acao?: string | null
          created_at?: string
          empresa_id?: string | null
          erro?: string | null
          id?: string
          modulo?: string | null
          registro_id?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string | null
          created_at?: string
          empresa_id?: string | null
          erro?: string | null
          id?: string
          modulo?: string | null
          registro_id?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      checklist_templates: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          itens: Json
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          itens?: Json
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          itens?: Json
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          convite_aceito_em: string | null
          convite_email_enviado_em: string | null
          convite_enviado_em: string | null
          convite_expira_em: string | null
          convite_token: string | null
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
          status_convite:
            | Database["public"]["Enums"]["status_convite_enum"]
            | null
          telefone: string
          tipo_cliente: Database["public"]["Enums"]["tipo_cliente"]
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          convite_aceito_em?: string | null
          convite_email_enviado_em?: string | null
          convite_enviado_em?: string | null
          convite_expira_em?: string | null
          convite_token?: string | null
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
          status_convite?:
            | Database["public"]["Enums"]["status_convite_enum"]
            | null
          telefone: string
          tipo_cliente?: Database["public"]["Enums"]["tipo_cliente"]
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          convite_aceito_em?: string | null
          convite_email_enviado_em?: string | null
          convite_enviado_em?: string | null
          convite_expira_em?: string | null
          convite_token?: string | null
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
          status_convite?:
            | Database["public"]["Enums"]["status_convite_enum"]
            | null
          telefone?: string
          tipo_cliente?: Database["public"]["Enums"]["tipo_cliente"]
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
          estornada_em: string | null
          estornada_por: string | null
          funcionario_id: string
          id: string
          mes_competencia: string | null
          observacoes: string | null
          ordem_id: string | null
          os_servico_id: string | null
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
          estornada_em?: string | null
          estornada_por?: string | null
          funcionario_id: string
          id?: string
          mes_competencia?: string | null
          observacoes?: string | null
          ordem_id?: string | null
          os_servico_id?: string | null
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
          estornada_em?: string | null
          estornada_por?: string | null
          funcionario_id?: string
          id?: string
          mes_competencia?: string | null
          observacoes?: string | null
          ordem_id?: string | null
          os_servico_id?: string | null
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
          {
            foreignKeyName: "comissoes_os_servico_id_fkey"
            columns: ["os_servico_id"]
            isOneToOne: false
            referencedRelation: "os_servicos"
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
          deleted_at: string | null
          descricao: string
          empresa_id: string | null
          fornecedor: string | null
          fornecedor_id: string | null
          id: string
          loja_id: string | null
          mes_competencia: string | null
          observacoes: string | null
          ordem_servico_id: string | null
          recorrente: boolean
          status: Database["public"]["Enums"]["status_conta"]
          updated_at: string
          valor: number
          valor_pago_centavos: number
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
          deleted_at?: string | null
          descricao: string
          empresa_id?: string | null
          fornecedor?: string | null
          fornecedor_id?: string | null
          id?: string
          loja_id?: string | null
          mes_competencia?: string | null
          observacoes?: string | null
          ordem_servico_id?: string | null
          recorrente?: boolean
          status?: Database["public"]["Enums"]["status_conta"]
          updated_at?: string
          valor: number
          valor_pago_centavos?: number
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
          deleted_at?: string | null
          descricao?: string
          empresa_id?: string | null
          fornecedor?: string | null
          fornecedor_id?: string | null
          id?: string
          loja_id?: string | null
          mes_competencia?: string | null
          observacoes?: string | null
          ordem_servico_id?: string | null
          recorrente?: boolean
          status?: Database["public"]["Enums"]["status_conta"]
          updated_at?: string
          valor?: number
          valor_pago_centavos?: number
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
      contas_pagar_pagamentos: {
        Row: {
          conta_pagar_id: string
          created_at: string
          created_by: string | null
          data_pagamento: string
          empresa_id: string
          estornado_em: string | null
          estornado_por: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento_conta"]
          id: string
          movimentacao_id: string | null
          observacao: string | null
          valor_centavos: number
        }
        Insert: {
          conta_pagar_id: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string
          empresa_id: string
          estornado_em?: string | null
          estornado_por?: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento_conta"]
          id?: string
          movimentacao_id?: string | null
          observacao?: string | null
          valor_centavos: number
        }
        Update: {
          conta_pagar_id?: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string
          empresa_id?: string
          estornado_em?: string | null
          estornado_por?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento_conta"]
          id?: string
          movimentacao_id?: string | null
          observacao?: string | null
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_pagamentos_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_a_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_pagamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_pagamentos_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: false
            referencedRelation: "movimentacoes_financeiras"
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
          assinatura_id: string | null
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
          assinatura_id?: string | null
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
          assinatura_id?: string | null
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
      equipe_metas: {
        Row: {
          ano: number
          bonus_equipe_batida: number | null
          created_at: string
          empresa_id: string
          id: string
          mes: number
          meta_faturamento: number | null
          meta_quantidade_os: number | null
          updated_at: string
        }
        Insert: {
          ano: number
          bonus_equipe_batida?: number | null
          created_at?: string
          empresa_id: string
          id?: string
          mes: number
          meta_faturamento?: number | null
          meta_quantidade_os?: number | null
          updated_at?: string
        }
        Update: {
          ano?: number
          bonus_equipe_batida?: number | null
          created_at?: string
          empresa_id?: string
          id?: string
          mes?: number
          meta_faturamento?: number | null
          meta_quantidade_os?: number | null
          updated_at?: string
        }
        Relationships: []
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
          ativo: boolean
          capacidade: string | null
          categoria_id: string | null
          codigo_barras: string | null
          cor: string | null
          created_at: string
          custo_medio: number
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
          preco_especial: number | null
          preco_venda: number | null
          quantidade: number
          quantidade_minima: number
          sku: string | null
          status: string
          tipo_item: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          capacidade?: string | null
          categoria_id?: string | null
          codigo_barras?: string | null
          cor?: string | null
          created_at?: string
          custo_medio?: number
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
          preco_especial?: number | null
          preco_venda?: number | null
          quantidade?: number
          quantidade_minima?: number
          sku?: string | null
          status?: string
          tipo_item?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          capacidade?: string | null
          categoria_id?: string | null
          codigo_barras?: string | null
          cor?: string | null
          created_at?: string
          custo_medio?: number
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
          preco_especial?: number | null
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
      estoque_lotes: {
        Row: {
          created_at: string
          created_by: string | null
          custo_unitario: number
          data_compra: string
          empresa_id: string
          fornecedor_id: string | null
          id: string
          observacoes: string | null
          origem: string
          origem_id: string | null
          peca_id: string
          quantidade_disponivel: number
          quantidade_inicial: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custo_unitario: number
          data_compra: string
          empresa_id: string
          fornecedor_id?: string | null
          id?: string
          observacoes?: string | null
          origem: string
          origem_id?: string | null
          peca_id: string
          quantidade_disponivel: number
          quantidade_inicial: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custo_unitario?: number
          data_compra?: string
          empresa_id?: string
          fornecedor_id?: string | null
          id?: string
          observacoes?: string | null
          origem?: string
          origem_id?: string | null
          peca_id?: string
          quantidade_disponivel?: number
          quantidade_inicial?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_lotes_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
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
      funcionario_importacoes_ponto: {
        Row: {
          arquivo_nome: string
          concluido_at: string | null
          created_at: string | null
          created_by: string | null
          empresa_id: string
          erros: Json | null
          id: string
          linhas_erro: number | null
          linhas_processadas: number | null
          linhas_total: number | null
          mes_referencia: string | null
          status: string
        }
        Insert: {
          arquivo_nome: string
          concluido_at?: string | null
          created_at?: string | null
          created_by?: string | null
          empresa_id: string
          erros?: Json | null
          id?: string
          linhas_erro?: number | null
          linhas_processadas?: number | null
          linhas_total?: number | null
          mes_referencia?: string | null
          status?: string
        }
        Update: {
          arquivo_nome?: string
          concluido_at?: string | null
          created_at?: string | null
          created_by?: string | null
          empresa_id?: string
          erros?: Json | null
          id?: string
          linhas_erro?: number | null
          linhas_processadas?: number | null
          linhas_total?: number | null
          mes_referencia?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionario_importacoes_ponto_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionario_movimentacoes: {
        Row: {
          comissao_id: string | null
          competencia_ano_mes: string
          conta_pagar_id: string | null
          created_at: string | null
          created_by: string | null
          data: string
          data_pagamento: string | null
          descricao: string | null
          empresa_id: string
          estornada_em: string | null
          forma_pagamento: string | null
          funcionario_id: string
          id: string
          motivo_estorno: string | null
          observacoes: string | null
          ponto_entrada_id: string | null
          status: Database["public"]["Enums"]["status_movimentacao_func"] | null
          tipo: Database["public"]["Enums"]["tipo_movimentacao_func"]
          valor_centavos: number
        }
        Insert: {
          comissao_id?: string | null
          competencia_ano_mes: string
          conta_pagar_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: string
          data_pagamento?: string | null
          descricao?: string | null
          empresa_id: string
          estornada_em?: string | null
          forma_pagamento?: string | null
          funcionario_id: string
          id?: string
          motivo_estorno?: string | null
          observacoes?: string | null
          ponto_entrada_id?: string | null
          status?:
            | Database["public"]["Enums"]["status_movimentacao_func"]
            | null
          tipo: Database["public"]["Enums"]["tipo_movimentacao_func"]
          valor_centavos: number
        }
        Update: {
          comissao_id?: string | null
          competencia_ano_mes?: string
          conta_pagar_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: string
          data_pagamento?: string | null
          descricao?: string | null
          empresa_id?: string
          estornada_em?: string | null
          forma_pagamento?: string | null
          funcionario_id?: string
          id?: string
          motivo_estorno?: string | null
          observacoes?: string | null
          ponto_entrada_id?: string | null
          status?:
            | Database["public"]["Enums"]["status_movimentacao_func"]
            | null
          tipo?: Database["public"]["Enums"]["tipo_movimentacao_func"]
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "funcionario_movimentacoes_comissao_id_fkey"
            columns: ["comissao_id"]
            isOneToOne: false
            referencedRelation: "comissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_movimentacoes_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_a_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_movimentacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_movimentacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_movimentacoes_ponto_entrada_id_fkey"
            columns: ["ponto_entrada_id"]
            isOneToOne: false
            referencedRelation: "funcionario_ponto_entradas"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionario_ponto_entradas: {
        Row: {
          abonada: boolean | null
          atestado_medico: boolean | null
          created_at: string | null
          created_by: string | null
          data: string
          empresa_id: string
          falta: boolean | null
          falta_justificada: boolean | null
          funcionario_id: string
          hora_entrada: string | null
          hora_saida: string | null
          hora_saida_almoco: string | null
          hora_volta_almoco: string | null
          horas_trabalhadas: number | null
          id: string
          importacao_id: string | null
          justificativa: string | null
          observacoes: string | null
          updated_at: string | null
        }
        Insert: {
          abonada?: boolean | null
          atestado_medico?: boolean | null
          created_at?: string | null
          created_by?: string | null
          data: string
          empresa_id: string
          falta?: boolean | null
          falta_justificada?: boolean | null
          funcionario_id: string
          hora_entrada?: string | null
          hora_saida?: string | null
          hora_saida_almoco?: string | null
          hora_volta_almoco?: string | null
          horas_trabalhadas?: number | null
          id?: string
          importacao_id?: string | null
          justificativa?: string | null
          observacoes?: string | null
          updated_at?: string | null
        }
        Update: {
          abonada?: boolean | null
          atestado_medico?: boolean | null
          created_at?: string | null
          created_by?: string | null
          data?: string
          empresa_id?: string
          falta?: boolean | null
          falta_justificada?: boolean | null
          funcionario_id?: string
          hora_entrada?: string | null
          hora_saida?: string | null
          hora_saida_almoco?: string | null
          hora_volta_almoco?: string | null
          horas_trabalhadas?: number | null
          id?: string
          importacao_id?: string | null
          justificativa?: string | null
          observacoes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionario_ponto_entradas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_ponto_entradas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          agencia: string | null
          ativo: boolean
          bairro: string | null
          banco: string | null
          carga_horaria: string | null
          carga_horaria_semanal: number | null
          cargo: string | null
          cep: string | null
          chave_pix: string | null
          cidade: string | null
          complemento: string | null
          conta_bancaria: string | null
          cpf: string | null
          created_at: string
          data_admissao: string | null
          data_demissao: string | null
          deleted_at: string | null
          eh_funcionario_rh: boolean
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
          observacoes_rh: string | null
          rg: string | null
          salario_centavos: number | null
          salario_fixo: number | null
          telefone: string | null
          tipo_comissao: Database["public"]["Enums"]["tipo_comissao"]
          tipo_vinculo: Database["public"]["Enums"]["tipo_vinculo_rh"] | null
          va_centavos: number | null
          vale_alimentacao: number | null
          vale_transporte: number | null
          valor_comissao: number
          valor_diaria_centavos: number | null
          vt_centavos: number | null
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          bairro?: string | null
          banco?: string | null
          carga_horaria?: string | null
          carga_horaria_semanal?: number | null
          cargo?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          complemento?: string | null
          conta_bancaria?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_demissao?: string | null
          deleted_at?: string | null
          eh_funcionario_rh?: boolean
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
          observacoes_rh?: string | null
          rg?: string | null
          salario_centavos?: number | null
          salario_fixo?: number | null
          telefone?: string | null
          tipo_comissao?: Database["public"]["Enums"]["tipo_comissao"]
          tipo_vinculo?: Database["public"]["Enums"]["tipo_vinculo_rh"] | null
          va_centavos?: number | null
          vale_alimentacao?: number | null
          vale_transporte?: number | null
          valor_comissao?: number
          valor_diaria_centavos?: number | null
          vt_centavos?: number | null
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          bairro?: string | null
          banco?: string | null
          carga_horaria?: string | null
          carga_horaria_semanal?: number | null
          cargo?: string | null
          cep?: string | null
          chave_pix?: string | null
          cidade?: string | null
          complemento?: string | null
          conta_bancaria?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_demissao?: string | null
          deleted_at?: string | null
          eh_funcionario_rh?: boolean
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
          observacoes_rh?: string | null
          rg?: string | null
          salario_centavos?: number | null
          salario_fixo?: number | null
          telefone?: string | null
          tipo_comissao?: Database["public"]["Enums"]["tipo_comissao"]
          tipo_vinculo?: Database["public"]["Enums"]["tipo_vinculo_rh"] | null
          va_centavos?: number | null
          vale_alimentacao?: number | null
          vale_transporte?: number | null
          valor_comissao?: number
          valor_diaria_centavos?: number | null
          vt_centavos?: number | null
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
      historico_custo_peca: {
        Row: {
          custo_anterior: number | null
          custo_novo: number
          empresa_id: string
          id: string
          origem: string
          origem_id: string | null
          peca_id: string
          preco_compra_unitario: number | null
          quantidade_anterior: number | null
          quantidade_movimentada: number | null
          registrado_em: string
          registrado_por: string | null
        }
        Insert: {
          custo_anterior?: number | null
          custo_novo: number
          empresa_id: string
          id?: string
          origem: string
          origem_id?: string | null
          peca_id: string
          preco_compra_unitario?: number | null
          quantidade_anterior?: number | null
          quantidade_movimentada?: number | null
          registrado_em?: string
          registrado_por?: string | null
        }
        Update: {
          custo_anterior?: number | null
          custo_novo?: number
          empresa_id?: string
          id?: string
          origem?: string
          origem_id?: string | null
          peca_id?: string
          preco_compra_unitario?: number | null
          quantidade_anterior?: number | null
          quantidade_movimentada?: number | null
          registrado_em?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_custo_peca_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
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
      ia_acoes_log: {
        Row: {
          aprovado_por: string | null
          argumentos: Json | null
          conversa_id: string | null
          criado_em: string
          empresa_id: string
          erro_mensagem: string | null
          id: string
          ids_afetados: string[] | null
          resultado: Json | null
          snapshot_antes: Json | null
          status: string
          tool_chamada: string
          usuario_id: string
        }
        Insert: {
          aprovado_por?: string | null
          argumentos?: Json | null
          conversa_id?: string | null
          criado_em?: string
          empresa_id: string
          erro_mensagem?: string | null
          id?: string
          ids_afetados?: string[] | null
          resultado?: Json | null
          snapshot_antes?: Json | null
          status?: string
          tool_chamada: string
          usuario_id: string
        }
        Update: {
          aprovado_por?: string | null
          argumentos?: Json | null
          conversa_id?: string | null
          criado_em?: string
          empresa_id?: string
          erro_mensagem?: string | null
          id?: string
          ids_afetados?: string[] | null
          resultado?: Json | null
          snapshot_antes?: Json | null
          status?: string
          tool_chamada?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_acoes_log_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "ia_conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_acoes_log_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_conversas: {
        Row: {
          atualizado_em: string
          contexto_origem: Json | null
          criado_em: string
          deleted_at: string | null
          empresa_id: string
          id: string
          titulo: string | null
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          contexto_origem?: Json | null
          criado_em?: string
          deleted_at?: string | null
          empresa_id: string
          id?: string
          titulo?: string | null
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          contexto_origem?: Json | null
          criado_em?: string
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          titulo?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_conversas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_mensagens: {
        Row: {
          conteudo: string | null
          conversa_id: string
          criado_em: string
          empresa_id: string
          id: string
          modelo: string | null
          papel: string
          tokens_input: number | null
          tokens_output: number | null
          tool_input: Json | null
          tool_name: string | null
          tool_result: Json | null
        }
        Insert: {
          conteudo?: string | null
          conversa_id: string
          criado_em?: string
          empresa_id: string
          id?: string
          modelo?: string | null
          papel: string
          tokens_input?: number | null
          tokens_output?: number | null
          tool_input?: Json | null
          tool_name?: string | null
          tool_result?: Json | null
        }
        Update: {
          conteudo?: string | null
          conversa_id?: string
          criado_em?: string
          empresa_id?: string
          id?: string
          modelo?: string | null
          papel?: string
          tokens_input?: number | null
          tokens_output?: number | null
          tool_input?: Json | null
          tool_name?: string | null
          tool_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "ia_conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_mensagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_uso_tokens: {
        Row: {
          atualizado_em: string
          bloqueado: boolean
          custo_brl: number
          empresa_id: string
          id: string
          mes_competencia: string
          teto_brl: number
          tokens_input: number
          tokens_output: number
        }
        Insert: {
          atualizado_em?: string
          bloqueado?: boolean
          custo_brl?: number
          empresa_id: string
          id?: string
          mes_competencia: string
          teto_brl?: number
          tokens_input?: number
          tokens_output?: number
        }
        Update: {
          atualizado_em?: string
          bloqueado?: boolean
          custo_brl?: number
          empresa_id?: string
          id?: string
          mes_competencia?: string
          teto_brl?: number
          tokens_input?: number
          tokens_output?: number
        }
        Relationships: [
          {
            foreignKeyName: "ia_uso_tokens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
      lojista_faturas: {
        Row: {
          created_at: string
          data_emissao: string | null
          data_pagamento: string | null
          empresa_id: string
          id: string
          lojista_id: string
          mes_competencia: string
          observacoes: string | null
          status: string
          total_geral: number
          total_pecas: number
          total_servicos: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_emissao?: string | null
          data_pagamento?: string | null
          empresa_id: string
          id?: string
          lojista_id: string
          mes_competencia: string
          observacoes?: string | null
          status?: string
          total_geral?: number
          total_pecas?: number
          total_servicos?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_emissao?: string | null
          data_pagamento?: string | null
          empresa_id?: string
          id?: string
          lojista_id?: string
          mes_competencia?: string
          observacoes?: string | null
          status?: string
          total_geral?: number
          total_pecas?: number
          total_servicos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lojista_faturas_lojista_id_fkey"
            columns: ["lojista_id"]
            isOneToOne: false
            referencedRelation: "lojistas"
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
      metas: {
        Row: {
          concluida_em: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          escopo: Database["public"]["Enums"]["escopo_meta"]
          escopo_id: string | null
          id: string
          metrica: Database["public"]["Enums"]["metric_meta"]
          nome: string
          periodo_fim: string
          periodo_inicio: string
          sentido: string
          status: Database["public"]["Enums"]["status_meta"]
          threshold_alerta: number
          threshold_atencao: number
          valor_alvo: number
          valor_atual: number
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          escopo: Database["public"]["Enums"]["escopo_meta"]
          escopo_id?: string | null
          id?: string
          metrica: Database["public"]["Enums"]["metric_meta"]
          nome: string
          periodo_fim: string
          periodo_inicio: string
          sentido?: string
          status?: Database["public"]["Enums"]["status_meta"]
          threshold_alerta?: number
          threshold_atencao?: number
          valor_alvo: number
          valor_atual?: number
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          escopo?: Database["public"]["Enums"]["escopo_meta"]
          escopo_id?: string | null
          id?: string
          metrica?: Database["public"]["Enums"]["metric_meta"]
          nome?: string
          periodo_fim?: string
          periodo_inicio?: string
          sentido?: string
          status?: Database["public"]["Enums"]["status_meta"]
          threshold_alerta?: number
          threshold_atencao?: number
          valor_alvo?: number
          valor_atual?: number
        }
        Relationships: []
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
          categoria: string | null
          cliente_id: string | null
          created_at: string
          data: string
          descricao: string
          empresa_id: string | null
          estoque_id: string | null
          estornada_em: string | null
          forma_pagamento: string | null
          id: string
          lojista_fatura_id: string | null
          ordem_id: string | null
          tipo: Database["public"]["Enums"]["tipo_movimentacao"]
          valor: number
        }
        Insert: {
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string
          data?: string
          descricao: string
          empresa_id?: string | null
          estoque_id?: string | null
          estornada_em?: string | null
          forma_pagamento?: string | null
          id?: string
          lojista_fatura_id?: string | null
          ordem_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimentacao"]
          valor: number
        }
        Update: {
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          empresa_id?: string | null
          estoque_id?: string | null
          estornada_em?: string | null
          forma_pagamento?: string | null
          id?: string
          lojista_fatura_id?: string | null
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
            foreignKeyName: "movimentacoes_financeiras_lojista_fatura_id_fkey"
            columns: ["lojista_fatura_id"]
            isOneToOne: false
            referencedRelation: "lojista_faturas"
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
          arquivada_em: string | null
          created_at: string | null
          empresa_id: string | null
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          referencia_id: string | null
          referencia_tabela: string | null
          severidade: string | null
          tipo: string
          titulo: string
          user_id: string | null
        }
        Insert: {
          arquivada_em?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          referencia_id?: string | null
          referencia_tabela?: string | null
          severidade?: string | null
          tipo: string
          titulo: string
          user_id?: string | null
        }
        Update: {
          arquivada_em?: string | null
          created_at?: string | null
          empresa_id?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          referencia_id?: string | null
          referencia_tabela?: string | null
          severidade?: string | null
          tipo?: string
          titulo?: string
          user_id?: string | null
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
          cancelada_em: string | null
          cancelada_por: string | null
          checklist_entrada: Json | null
          contato_preferido: string | null
          created_at: string
          created_by: string | null
          criada_retroativamente_por: string | null
          custo_mao_de_obra: number
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
          eh_retroativa: boolean
          empresa_id: string | null
          estado_geral: string | null
          fatura_id: string | null
          forma_pagamento_id: string | null
          forma_pagamento_sinal: string | null
          funcionario_id: string | null
          garantia_dias: number
          id: string
          imei2: string | null
          impacto_cancelamento: Json | null
          justificativa_retroativa: string | null
          liga: string | null
          localizacao: string | null
          loja_id: string | null
          lojista_id: string | null
          lucro_bruto: number | null
          mao_obra_adicional: number
          margem_calculada: number
          motivo_cancelamento: string | null
          motivo_reprovacao: string | null
          numero: number
          numero_formatado: string | null
          obs_cliente: string | null
          observacoes: string | null
          orcamento_aprovado_em: string | null
          orcamento_decidido_por_user: string | null
          orcamento_motivo_reprovacao: string | null
          orcamento_reprovado_em: string | null
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
          tipo_servico: string | null
          tipo_servico_id: string | null
          updated_at: string
          updated_by: string | null
          valor: number | null
          valor_pago: number | null
          valor_pendente: number | null
          valor_total: number | null
          valor_total_pecas: number
          valor_total_servicos: number
        }
        Insert: {
          aparelho_id: string
          aprovacao_orcamento?: string | null
          aprovado_no_ato?: boolean | null
          bateria_entrada?: number | null
          cancelada_em?: string | null
          cancelada_por?: string | null
          checklist_entrada?: Json | null
          contato_preferido?: string | null
          created_at?: string
          created_by?: string | null
          criada_retroativamente_por?: string | null
          custo_mao_de_obra?: number
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
          eh_retroativa?: boolean
          empresa_id?: string | null
          estado_geral?: string | null
          fatura_id?: string | null
          forma_pagamento_id?: string | null
          forma_pagamento_sinal?: string | null
          funcionario_id?: string | null
          garantia_dias?: number
          id?: string
          imei2?: string | null
          impacto_cancelamento?: Json | null
          justificativa_retroativa?: string | null
          liga?: string | null
          localizacao?: string | null
          loja_id?: string | null
          lojista_id?: string | null
          lucro_bruto?: number | null
          mao_obra_adicional?: number
          margem_calculada?: number
          motivo_cancelamento?: string | null
          motivo_reprovacao?: string | null
          numero?: number
          numero_formatado?: string | null
          obs_cliente?: string | null
          observacoes?: string | null
          orcamento_aprovado_em?: string | null
          orcamento_decidido_por_user?: string | null
          orcamento_motivo_reprovacao?: string | null
          orcamento_reprovado_em?: string | null
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
          tipo_servico?: string | null
          tipo_servico_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: number | null
          valor_pago?: number | null
          valor_pendente?: number | null
          valor_total?: number | null
          valor_total_pecas?: number
          valor_total_servicos?: number
        }
        Update: {
          aparelho_id?: string
          aprovacao_orcamento?: string | null
          aprovado_no_ato?: boolean | null
          bateria_entrada?: number | null
          cancelada_em?: string | null
          cancelada_por?: string | null
          checklist_entrada?: Json | null
          contato_preferido?: string | null
          created_at?: string
          created_by?: string | null
          criada_retroativamente_por?: string | null
          custo_mao_de_obra?: number
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
          eh_retroativa?: boolean
          empresa_id?: string | null
          estado_geral?: string | null
          fatura_id?: string | null
          forma_pagamento_id?: string | null
          forma_pagamento_sinal?: string | null
          funcionario_id?: string | null
          garantia_dias?: number
          id?: string
          imei2?: string | null
          impacto_cancelamento?: Json | null
          justificativa_retroativa?: string | null
          liga?: string | null
          localizacao?: string | null
          loja_id?: string | null
          lojista_id?: string | null
          lucro_bruto?: number | null
          mao_obra_adicional?: number
          margem_calculada?: number
          motivo_cancelamento?: string | null
          motivo_reprovacao?: string | null
          numero?: number
          numero_formatado?: string | null
          obs_cliente?: string | null
          observacoes?: string | null
          orcamento_aprovado_em?: string | null
          orcamento_decidido_por_user?: string | null
          orcamento_motivo_reprovacao?: string | null
          orcamento_reprovado_em?: string | null
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
          tipo_servico?: string | null
          tipo_servico_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: number | null
          valor_pago?: number | null
          valor_pendente?: number | null
          valor_total?: number | null
          valor_total_pecas?: number
          valor_total_servicos?: number
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
            foreignKeyName: "ordens_de_servico_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "lojista_faturas"
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
      os_auditoria: {
        Row: {
          acao: string
          created_at: string
          empresa_id: string
          id: string
          ip_address: string | null
          motivo: string | null
          ordem_id: string
          payload: Json | null
          realizada_por: string
          realizada_por_nome: string
          realizada_por_role: string
          user_agent: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          empresa_id: string
          id?: string
          ip_address?: string | null
          motivo?: string | null
          ordem_id: string
          payload?: Json | null
          realizada_por: string
          realizada_por_nome: string
          realizada_por_role: string
          user_agent?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          empresa_id?: string
          id?: string
          ip_address?: string | null
          motivo?: string | null
          ordem_id?: string
          payload?: Json | null
          realizada_por?: string
          realizada_por_nome?: string
          realizada_por_role?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_auditoria_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_checklist_saida: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          item_key: string
          item_label: string
          observacao: string | null
          ordem_id: string
          testado: boolean
          testado_em: string | null
          testado_por: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          item_key: string
          item_label: string
          observacao?: string | null
          ordem_id: string
          testado?: boolean
          testado_em?: string | null
          testado_por?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          item_key?: string
          item_label?: string
          observacao?: string | null
          ordem_id?: string
          testado?: boolean
          testado_em?: string | null
          testado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "os_checklist_saida_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_fotos: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          legenda: string | null
          ordem_id: string
          tipo: string
          uploaded_by: string | null
          url_storage: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          legenda?: string | null
          ordem_id: string
          tipo: string
          uploaded_by?: string | null
          url_storage: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          legenda?: string | null
          ordem_id?: string
          tipo?: string
          uploaded_by?: string | null
          url_storage?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_fotos_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      os_servicos: {
        Row: {
          categoria: string | null
          comissao: number
          concluido_em: string | null
          created_at: string
          empresa_id: string | null
          id: string
          iniciado_em: string | null
          nome: string
          ordem_id: string
          servico_id: string | null
          status: Database["public"]["Enums"]["status_servico"]
          tecnico_id: string | null
          valor: number
        }
        Insert: {
          categoria?: string | null
          comissao?: number
          concluido_em?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          iniciado_em?: string | null
          nome: string
          ordem_id: string
          servico_id?: string | null
          status?: Database["public"]["Enums"]["status_servico"]
          tecnico_id?: string | null
          valor?: number
        }
        Update: {
          categoria?: string | null
          comissao?: number
          concluido_em?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          iniciado_em?: string | null
          nome?: string
          ordem_id?: string
          servico_id?: string | null
          status?: Database["public"]["Enums"]["status_servico"]
          tecnico_id?: string | null
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
          {
            foreignKeyName: "os_servicos_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      os_transferencias: {
        Row: {
          created_at: string
          data_resposta: string | null
          data_solicitacao: string
          empresa_id: string
          funcionario_destino_id: string
          funcionario_origem_id: string
          id: string
          motivo: string | null
          ordem_id: string
          respondido_por: string | null
          resposta_observacao: string | null
          solicitado_por: string | null
          status: string
        }
        Insert: {
          created_at?: string
          data_resposta?: string | null
          data_solicitacao?: string
          empresa_id: string
          funcionario_destino_id: string
          funcionario_origem_id: string
          id?: string
          motivo?: string | null
          ordem_id: string
          respondido_por?: string | null
          resposta_observacao?: string | null
          solicitado_por?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          data_resposta?: string | null
          data_solicitacao?: string
          empresa_id?: string
          funcionario_destino_id?: string
          funcionario_origem_id?: string
          id?: string
          motivo?: string | null
          ordem_id?: string
          respondido_por?: string | null
          resposta_observacao?: string | null
          solicitado_por?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_transferencias_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_clientes: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          data_pagamento: string
          deleted_at: string | null
          deleted_by: string | null
          empresa_id: string
          forma_pagamento: string
          id: string
          observacoes: string | null
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string
          deleted_at?: string | null
          deleted_by?: string | null
          empresa_id: string
          forma_pagamento?: string
          id?: string
          observacoes?: string | null
          valor: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string
          deleted_at?: string | null
          deleted_by?: string | null
          empresa_id?: string
          forma_pagamento?: string
          id?: string
          observacoes?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
      pecas_utilizadas_lotes: {
        Row: {
          created_at: string
          custo_unitario_snapshot: number
          empresa_id: string
          id: string
          lote_id: string
          peca_utilizada_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          custo_unitario_snapshot: number
          empresa_id: string
          id?: string
          lote_id: string
          peca_utilizada_id: string
          quantidade: number
        }
        Update: {
          created_at?: string
          custo_unitario_snapshot?: number
          empresa_id?: string
          id?: string
          lote_id?: string
          peca_utilizada_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "pecas_utilizadas_lotes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "estoque_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pecas_utilizadas_lotes_peca_utilizada_id_fkey"
            columns: ["peca_utilizada_id"]
            isOneToOne: false
            referencedRelation: "pecas_utilizadas"
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
      prejuizos: {
        Row: {
          created_at: string
          created_by: string | null
          data_evento: string
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          movimentacao_financeira_id: string | null
          observacoes: string | null
          origem: string
          os_origem_id: string | null
          os_retrabalho_id: string | null
          tipo: Database["public"]["Enums"]["tipo_prejuizo"]
          updated_at: string
          updated_by: string | null
          valor_centavos: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_evento?: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          movimentacao_financeira_id?: string | null
          observacoes?: string | null
          origem?: string
          os_origem_id?: string | null
          os_retrabalho_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_prejuizo"]
          updated_at?: string
          updated_by?: string | null
          valor_centavos: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_evento?: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          movimentacao_financeira_id?: string | null
          observacoes?: string | null
          origem?: string
          os_origem_id?: string | null
          os_retrabalho_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_prejuizo"]
          updated_at?: string
          updated_by?: string | null
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "prejuizos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prejuizos_movimentacao_financeira_id_fkey"
            columns: ["movimentacao_financeira_id"]
            isOneToOne: false
            referencedRelation: "movimentacoes_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prejuizos_os_origem_id_fkey"
            columns: ["os_origem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prejuizos_os_retrabalho_id_fkey"
            columns: ["os_retrabalho_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
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
      rate_limit_tentativas: {
        Row: {
          acao: string
          created_at: string
          id: string
          identificador: string
        }
        Insert: {
          acao: string
          created_at?: string
          id?: string
          identificador: string
        }
        Update: {
          acao?: string
          created_at?: string
          id?: string
          identificador?: string
        }
        Relationships: []
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
      recebimentos_clientes: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          data_pagamento: string
          deleted_at: string | null
          empresa_id: string
          forma_pagamento: string
          id: string
          movimentacao_financeira_id: string | null
          observacoes: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string
          deleted_at?: string | null
          empresa_id: string
          forma_pagamento?: string
          id?: string
          movimentacao_financeira_id?: string | null
          observacoes?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data_pagamento?: string
          deleted_at?: string | null
          empresa_id?: string
          forma_pagamento?: string
          id?: string
          movimentacao_financeira_id?: string | null
          observacoes?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_clientes_movimentacao_financeira_id_fkey"
            columns: ["movimentacao_financeira_id"]
            isOneToOne: false
            referencedRelation: "movimentacoes_financeiras"
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
      tecnicos_metas: {
        Row: {
          ano: number
          bonus_meta_batida: number | null
          created_at: string
          created_by: string | null
          empresa_id: string
          funcionario_id: string
          id: string
          mes: number
          meta_quantidade_os: number | null
          meta_valor_servicos: number | null
          observacoes: string | null
          salario_base: number | null
          updated_at: string
        }
        Insert: {
          ano: number
          bonus_meta_batida?: number | null
          created_at?: string
          created_by?: string | null
          empresa_id: string
          funcionario_id: string
          id?: string
          mes: number
          meta_quantidade_os?: number | null
          meta_valor_servicos?: number | null
          observacoes?: string | null
          salario_base?: number | null
          updated_at?: string
        }
        Update: {
          ano?: number
          bonus_meta_batida?: number | null
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          funcionario_id?: string
          id?: string
          mes?: number
          meta_quantidade_os?: number | null
          meta_valor_servicos?: number | null
          observacoes?: string | null
          salario_base?: number | null
          updated_at?: string
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
      tv_paineis: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          intervalo_refresh_segundos: number
          layout: Json | null
          logo_url: string | null
          nome: string
          orientacao: string
          tamanho_fonte: string | null
          tema: string
          ultimo_acesso_em: string | null
          updated_at: string
          widgets: Json
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          intervalo_refresh_segundos?: number
          layout?: Json | null
          logo_url?: string | null
          nome: string
          orientacao?: string
          tamanho_fonte?: string | null
          tema?: string
          ultimo_acesso_em?: string | null
          updated_at?: string
          widgets?: Json
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          intervalo_refresh_segundos?: number
          layout?: Json | null
          logo_url?: string | null
          nome?: string
          orientacao?: string
          tamanho_fonte?: string | null
          tema?: string
          ultimo_acesso_em?: string | null
          updated_at?: string
          widgets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tv_paineis_empresa_id_fkey"
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
      aceitar_convite_cliente: { Args: { p_token: string }; Returns: Json }
      alterar_tipo_cliente: {
        Args: { p_cliente_id: string; p_novo_tipo: string }
        Returns: Json
      }
      aplicar_acao_banco_horas: {
        Args: {
          p_acao: string
          p_competencia: string
          p_funcionario_id: string
          p_horas: number
        }
        Returns: Json
      }
      atualizar_cliente: {
        Args: { p_cliente_id: string; p_dados: Json }
        Returns: Json
      }
      atualizar_user_profile: {
        Args: {
          p_ativo?: boolean
          p_perfil_id?: string
          p_user_profile_id: string
        }
        Returns: Json
      }
      bulk_atribuir_tecnico_os: {
        Args: { p_funcionario_id: string; p_ordem_ids: string[] }
        Returns: Json
      }
      bulk_atualizar_status_os: {
        Args: {
          p_novo_status: Database["public"]["Enums"]["status_ordem"]
          p_ordem_ids: string[]
        }
        Returns: Json
      }
      buscar_ordens_servico: {
        Args: {
          p_cliente_prefix?: string
          p_empresa_id: string
          p_imei_prefix?: string
          p_limit?: number
          p_os_prefix?: string
          p_status?: string
          p_tel_prefix?: string
          p_tokens?: string[]
        }
        Returns: {
          id: string
        }[]
      }
      calc_meta_aprovacao_orcamento: {
        Args: {
          p_escopo: string
          p_escopo_id: string
          p_fim: string
          p_inicio: string
        }
        Returns: number
      }
      calc_meta_comissao_paga: {
        Args: {
          p_escopo: string
          p_escopo_id: string
          p_fim: string
          p_inicio: string
        }
        Returns: number
      }
      calc_meta_faturamento: {
        Args: {
          p_escopo: string
          p_escopo_id: string
          p_fim: string
          p_inicio: string
        }
        Returns: number
      }
      calc_meta_margem_os: {
        Args: {
          p_escopo: string
          p_escopo_id: string
          p_fim: string
          p_inicio: string
        }
        Returns: number
      }
      calc_meta_qtd_os: {
        Args: {
          p_escopo: string
          p_escopo_id: string
          p_fim: string
          p_inicio: string
        }
        Returns: number
      }
      calc_meta_qtd_servicos: {
        Args: {
          p_escopo: string
          p_escopo_id: string
          p_fim: string
          p_inicio: string
        }
        Returns: number
      }
      calc_meta_retorno_cliente: {
        Args: {
          p_escopo: string
          p_escopo_id: string
          p_fim: string
          p_inicio: string
        }
        Returns: number
      }
      calc_meta_retrabalho: {
        Args: {
          p_escopo: string
          p_escopo_id: string
          p_fim: string
          p_inicio: string
        }
        Returns: number
      }
      calc_meta_tempo_medio: {
        Args: {
          p_escopo: string
          p_escopo_id: string
          p_fim: string
          p_inicio: string
        }
        Returns: number
      }
      calc_meta_ticket_medio: {
        Args: {
          p_escopo: string
          p_escopo_id: string
          p_fim: string
          p_inicio: string
        }
        Returns: number
      }
      calcular_banco_horas: {
        Args: { p_competencia: string; p_funcionario_id: string }
        Returns: Json
      }
      calcular_custo_pecas_os: { Args: { p_os_id: string }; Returns: number }
      calcular_progresso_meta: { Args: { p_meta_id: string }; Returns: Json }
      cancelar_os: {
        Args: { p_motivo: string; p_ordem_id: string }
        Returns: Json
      }
      checar_rate_limit: {
        Args: {
          p_acao: string
          p_identificador: string
          p_janela_segundos?: number
          p_max_tentativas?: number
        }
        Returns: Json
      }
      comissoes_tecnico_periodo: {
        Args: { p_fim: string; p_funcionario_id: string; p_inicio: string }
        Returns: Json
      }
      concluir_servico_os: { Args: { p_os_servico_id: string }; Returns: Json }
      consolidar_comissoes_em_contas_pagar: {
        Args: { p_competencia: string }
        Returns: Json
      }
      consultar_convite_publico: { Args: { p_token: string }; Returns: Json }
      consultar_os_publica: {
        Args: { p_numero: string; p_telefone_4digitos: string }
        Returns: Json
      }
      consumir_estoque_fifo: {
        Args: {
          p_lote_id_especifico?: string
          p_peca_id: string
          p_quantidade: number
        }
        Returns: Json
      }
      criar_convite_cliente:
        | { Args: { p_cliente_id: string }; Returns: Json }
        | { Args: { p_cliente_id: string; p_email?: string }; Returns: Json }
      criar_funcionario_rh: {
        Args: {
          p_carga_horaria_semanal?: number
          p_cargo?: string
          p_cpf?: string
          p_data_admissao?: string
          p_email?: string
          p_nome: string
          p_salario_centavos?: number
          p_telefone?: string
          p_tipo_vinculo?: string
          p_va_centavos?: number
          p_valor_diaria_centavos?: number
          p_vt_centavos?: number
        }
        Returns: Json
      }
      criar_lote_compra: {
        Args: {
          p_custo_unitario: number
          p_data_compra: string
          p_fornecedor_id?: string
          p_observacoes?: string
          p_origem: string
          p_origem_id?: string
          p_peca_id: string
          p_quantidade: number
        }
        Returns: string
      }
      criar_notificacao_unica: {
        Args: {
          p_dedupe_hours?: number
          p_empresa_id: string
          p_link?: string
          p_mensagem: string
          p_referencia_id?: string
          p_referencia_tabela?: string
          p_severidade?: string
          p_tipo: string
          p_titulo: string
        }
        Returns: string
      }
      criar_os_com_data: {
        Args: {
          p_dados: Json
          p_data_entrada: string
          p_justificativa?: string
        }
        Returns: Json
      }
      criar_pagamento_cliente: {
        Args: {
          p_cliente_id: string
          p_data?: string
          p_forma?: string
          p_obs?: string
          p_valor: number
        }
        Returns: Json
      }
      criar_prejuizo: {
        Args: {
          p_data_evento?: string
          p_descricao?: string
          p_observacoes?: string
          p_origem?: string
          p_os_origem_id?: string
          p_os_retrabalho_id?: string
          p_tipo: Database["public"]["Enums"]["tipo_prejuizo"]
          p_valor_centavos: number
        }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      derivar_status_por_datas: {
        Args: {
          p_data_conclusao: string
          p_data_entrega: string
          p_status_atual: string
        }
        Returns: string
      }
      devolver_estoque_lotes: {
        Args: { p_peca_utilizada_id: string }
        Returns: undefined
      }
      editar_datas_os:
        | {
            Args: {
              p_data_conclusao?: string
              p_data_entrega?: string
              p_os_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_data_conclusao?: string
              p_data_entrega?: string
              p_limpar_conclusao?: boolean
              p_limpar_entrega?: boolean
              p_os_id: string
            }
            Returns: Json
          }
      editar_datas_os_em_massa: {
        Args: {
          p_aplicar_conclusao?: boolean
          p_aplicar_entrega?: boolean
          p_data_conclusao?: string
          p_data_entrega?: string
          p_os_ids: string[]
        }
        Returns: Json
      }
      editar_os_admin: {
        Args: {
          p_dados: Json
          p_motivo_pulo?: string
          p_ordem_id: string
          p_pulou_fluxo?: boolean
        }
        Returns: Json
      }
      editar_os_servicos: {
        Args: { p_adicionar: string[]; p_ordem_id: string; p_remover: string[] }
        Returns: Json
      }
      editar_os_servicos_v2: {
        Args: { p_ordem_id: string; p_servicos: Json }
        Returns: Json
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_demo_user: {
        Args: { p_email: string; p_user_id: string }
        Returns: undefined
      }
      estornar_pagamento_conta: {
        Args: { p_pagamento_id: string }
        Returns: Json
      }
      estornar_recebimento_cliente: {
        Args: { p_recebimento_id: string }
        Returns: Json
      }
      excluir_definitivamente_os_cancelada: {
        Args: { p_confirmacao: string; p_ordem_id: string }
        Returns: Json
      }
      excluir_definitivamente_os_canceladas_lote: {
        Args: { p_confirmacao: string; p_ordem_ids: string[] }
        Returns: Json
      }
      extrato_cliente: {
        Args: { p_cliente_id: string; p_fim?: string; p_inicio?: string }
        Returns: {
          data: string
          descricao: string
          referencia_id: string
          referencia_numero: string
          saldo_apos: number
          tipo: string
          valor: number
        }[]
      }
      extrato_funcionario: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_funcionario_id: string
        }
        Returns: Json
      }
      gerar_codigo_tv: { Args: never; Returns: string }
      gerar_folha_mensal: { Args: { p_competencia: string }; Returns: Json }
      gerar_folha_mensal_completa: {
        Args: { p_competencia: string; p_dia_vencimento?: number }
        Returns: Json
      }
      gerar_movimentacao_entrada_os: {
        Args: { p_ordem_id: string }
        Returns: undefined
      }
      gerar_ou_atualizar_fatura_lojista: {
        Args: { p_lojista_id: string; p_mes: string }
        Returns: string
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
      get_dashboard_summary: {
        Args: { p_fim?: string; p_inicio?: string }
        Returns: Json
      }
      get_extrato_cliente: {
        Args: { p_cliente_id: string; p_fim?: string; p_inicio?: string }
        Returns: {
          credito: number
          data: string
          debito: number
          descricao: string
          imei: string
          modelo_aparelho: string
          referencia_id: string
          saldo_apos: number
          servicos_realizados: string
          tipo: string
        }[]
      }
      get_my_cliente_lojista: {
        Args: never
        Returns: {
          cliente_id: string
          empresa_id: string
        }[]
      }
      get_my_empresa_id: { Args: never; Returns: string }
      get_my_lojista_id: { Args: never; Returns: string }
      get_my_permissoes: { Args: never; Returns: Json }
      get_my_role: { Args: never; Returns: string }
      get_saldo_cliente: { Args: { p_cliente_id: string }; Returns: Json }
      get_saldos_clientes_resumo: {
        Args: never
        Returns: {
          cliente_id: string
          nome: string
          qtd_oss: number
          saldo_devedor: number
          total_faturado: number
          total_recebido: number
          ultima_os_data: string
          ultimo_pagamento_data: string
        }[]
      }
      historico_pagamentos_conta: {
        Args: { p_conta_pagar_id: string }
        Returns: Json
      }
      holerite_funcionario: {
        Args: { p_competencia: string; p_funcionario_id: string }
        Returns: Json
      }
      ia_agregar_aparelhos_periodo: {
        Args: {
          p_cliente_busca?: string
          p_data_fim?: string
          p_data_inicio?: string
          p_limite?: number
          p_marca_busca?: string
          p_modelo_busca?: string
          p_modelo_exato?: boolean
        }
        Returns: Json
      }
      ia_buscar_os: {
        Args: {
          p_cliente_busca?: string
          p_data_fim?: string
          p_data_inicio?: string
          p_limite?: number
          p_status?: string[]
          p_tecnico_id?: string
        }
        Returns: Json
      }
      ia_comparar_periodos: {
        Args: {
          p_p1_fim: string
          p_p1_inicio: string
          p_p2_fim: string
          p_p2_inicio: string
        }
        Returns: Json
      }
      ia_criar_conversa: {
        Args: { p_contexto?: Json; p_titulo?: string }
        Returns: Json
      }
      ia_detalhar_os: { Args: { p_os_id: string }; Returns: Json }
      ia_historico_servico: {
        Args: { p_defeito?: string; p_modelo?: string }
        Returns: Json
      }
      ia_lista_compras_pecas: { Args: never; Returns: Json }
      ia_metricas_periodo: {
        Args: { p_fim: string; p_inicio: string }
        Returns: Json
      }
      ia_os_em_risco_atraso: { Args: never; Returns: Json }
      ia_pode_usar: { Args: never; Returns: Json }
      ia_preview_acao_em_massa: {
        Args: { p_acao: string; p_filtro: Json }
        Returns: Json
      }
      ia_registrar_uso: {
        Args: {
          p_empresa_id: string
          p_modelo: string
          p_tokens_input: number
          p_tokens_output: number
        }
        Returns: Json
      }
      ia_top_defeitos_periodo: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_limite?: number
          p_marca_busca?: string
          p_modelo_busca?: string
        }
        Returns: Json
      }
      ia_validar_proposta_status: {
        Args: { p_novo_status: string; p_os_id: string }
        Returns: Json
      }
      importar_ponto_planilha: {
        Args: {
          p_arquivo_nome: string
          p_entradas: Json
          p_mes_referencia: string
        }
        Returns: Json
      }
      iniciar_servico_os: { Args: { p_os_servico_id: string }; Returns: Json }
      is_admin_ou_gerente: { Args: never; Returns: boolean }
      is_admin_user: { Args: { _user_id: string }; Returns: boolean }
      is_internal_user: { Args: { _user_id: string }; Returns: boolean }
      kpi_tecnicos: {
        Args: { p_fim: string; p_inicio: string; p_loja_id?: string }
        Returns: Json
      }
      liberar_comissao: { Args: { p_comissao_id: string }; Returns: Json }
      limpar_rate_limit_antigos: { Args: never; Returns: number }
      listar_funcionarios_rh: { Args: never; Returns: Json }
      listar_metas_com_progresso: { Args: { p_status?: string }; Returns: Json }
      listar_prejuizos: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_limit?: number
          p_offset?: number
          p_origem?: string
          p_tipo?: Database["public"]["Enums"]["tipo_prejuizo"]
        }
        Returns: Json
      }
      listar_todos_funcionarios: { Args: never; Returns: Json }
      lojista_verificar_acesso: {
        Args: { email_input: string }
        Returns: {
          empresa_id: string
          existe: boolean
          lojista_id: string
          status_acesso: string
          user_id: string
        }[]
      }
      marcar_notificacao: {
        Args: { p_acao: string; p_notif_id: string }
        Returns: Json
      }
      marcar_os_pagas_em_massa: { Args: { p_os_ids: string[] }; Returns: Json }
      marcar_todas_notificacoes_lidas: { Args: never; Returns: Json }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      pagar_comissao: { Args: { p_comissao_id: string }; Returns: Json }
      pagar_comissoes_em_lote: {
        Args: { p_comissao_ids: string[] }
        Returns: Json
      }
      pagar_movimentacoes: {
        Args: {
          p_criar_conta_pagar?: boolean
          p_forma_pagamento?: string
          p_movimentacao_ids: string[]
        }
        Returns: Json
      }
      portal_aprovar_orcamento: { Args: { p_os_id: string }; Returns: Json }
      portal_dashboard_lojista: { Args: never; Returns: Json }
      portal_detalhe_ordem: { Args: { p_os_id: string }; Returns: Json }
      portal_listar_ordens: {
        Args: { p_status_filter?: string }
        Returns: Json
      }
      portal_reprovar_orcamento: {
        Args: { p_motivo?: string; p_os_id: string }
        Returns: Json
      }
      prejuizos_evolucao_mensal: { Args: { p_meses?: number }; Returns: Json }
      prejuizos_por_tecnico: {
        Args: { p_data_fim?: string; p_data_inicio?: string }
        Returns: Json
      }
      prejuizos_por_tipo: {
        Args: { p_data_fim?: string; p_data_inicio?: string }
        Returns: Json
      }
      prejuizos_resumo_periodo: {
        Args: { p_data_fim?: string; p_data_inicio?: string }
        Returns: Json
      }
      preview_cancelamento_os: { Args: { p_ordem_id: string }; Returns: Json }
      preview_exclusao_os_cancelada: {
        Args: { p_ordem_id: string }
        Returns: Json
      }
      processar_notificacoes_diarias: { Args: never; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reativar_usuario: { Args: { p_user_profile_id: string }; Returns: Json }
      recalcular_custo_medio: {
        Args: {
          p_origem: string
          p_origem_id?: string
          p_peca_id: string
          p_preco_compra_unitario: number
          p_quantidade_entrada: number
        }
        Returns: number
      }
      recalcular_totais_os: { Args: { p_ordem_id: string }; Returns: undefined }
      registrar_falta: {
        Args: {
          p_abonada?: boolean
          p_atestado_medico?: boolean
          p_data: string
          p_falta_justificada?: boolean
          p_funcionario_id: string
          p_justificativa?: string
        }
        Returns: Json
      }
      registrar_pagamento_conta: {
        Args: {
          p_conta_pagar_id: string
          p_data_pagamento?: string
          p_forma_pagamento: string
          p_observacao?: string
          p_valor_centavos: number
        }
        Returns: Json
      }
      registrar_recebimento_cliente: {
        Args: {
          p_cliente_id: string
          p_data_pagamento?: string
          p_forma_pagamento?: string
          p_observacoes?: string
          p_valor: number
        }
        Returns: Json
      }
      replicar_contas_recorrentes: {
        Args: { p_destino: string; p_origem: string }
        Returns: {
          destino: string
          inseridas: number
          origem: string
          puladas: number
        }[]
      }
      replicar_contas_recorrentes_mes_atual: {
        Args: never
        Returns: {
          destino: string
          inseridas: number
          origem: string
          puladas: number
        }[]
      }
      revogar_convite_cliente: { Args: { p_cliente_id: string }; Returns: Json }
      revogar_usuario: { Args: { p_user_profile_id: string }; Returns: Json }
      saldo_devedor_cliente: { Args: { p_cliente_id: string }; Returns: number }
      salvar_perfil_acesso: {
        Args: {
          p_ativo?: boolean
          p_descricao?: string
          p_nome_perfil?: string
          p_perfil_id?: string
          p_permissoes?: Json
        }
        Returns: Json
      }
      soltar_servico_os: { Args: { p_os_servico_id: string }; Returns: Json }
      tv_atualizar_layout: {
        Args: {
          p_layout: Json
          p_logo_url?: string
          p_painel_id: string
          p_tamanho_fonte?: string
        }
        Returns: Json
      }
      tv_atualizar_painel: {
        Args: {
          p_intervalo_refresh?: number
          p_nome?: string
          p_orientacao?: string
          p_painel_id: string
          p_tema?: string
          p_widgets?: Json
        }
        Returns: Json
      }
      tv_criar_painel: {
        Args: {
          p_intervalo_refresh?: number
          p_nome: string
          p_orientacao?: string
          p_tema?: string
          p_widgets: Json
        }
        Returns: Json
      }
      tv_get_painel_data: { Args: { p_codigo: string }; Returns: Json }
      tv_regenerar_codigo: { Args: { p_painel_id: string }; Returns: Json }
      unaccent: { Args: { "": string }; Returns: string }
      unaccent_lower: { Args: { txt: string }; Returns: string }
      verificar_lojista_por_email: {
        Args: { email_input: string }
        Returns: {
          existe: boolean
          status: string
        }[]
      }
    }
    Enums: {
      acao_hora_excedente:
        | "pendente_decisao"
        | "pago_como_extra"
        | "mantido_em_banco"
        | "compensado"
      escopo_meta: "empresa" | "tecnico" | "loja"
      forma_pagamento_conta: "pix" | "dinheiro" | "cartao" | "transferencia"
      metric_meta:
        | "faturamento"
        | "qtd_os"
        | "qtd_servicos"
        | "ticket_medio"
        | "comissao_paga"
        | "margem_os"
        | "tempo_medio_horas"
        | "retrabalho_taxa"
        | "aprovacao_orcamento_taxa"
        | "retorno_cliente_30d"
      status_comissao: "pendente" | "liberada" | "paga" | "estornada"
      status_conferencia: "em_andamento" | "finalizada"
      status_conta: "pendente" | "paga" | "vencida" | "cancelada" | "parcial"
      status_convite_enum: "pendente" | "aceito" | "revogado" | "expirado"
      status_estoque_aparelho:
        | "disponivel"
        | "em_assistencia"
        | "em_transporte"
        | "vendido"
      status_meta: "ativa" | "pausada" | "concluida_sucesso" | "concluida_falha"
      status_movimentacao_func: "pendente" | "pago" | "estornado"
      status_ordem:
        | "recebido"
        | "em_analise"
        | "aguardando_aprovacao"
        | "aprovado"
        | "em_reparo"
        | "aguardando_peca"
        | "pronto"
        | "entregue"
        | "cancelado"
      status_servico: "pendente" | "em_reparo" | "concluido" | "cancelado"
      tipo_cliente: "lojista_b2b" | "consumidor_b2c"
      tipo_comissao: "fixa" | "percentual" | "fixo_por_os" | "percentual_lucro"
      tipo_movimentacao: "entrada" | "saida" | "prejuizo"
      tipo_movimentacao_func:
        | "salario"
        | "comissao"
        | "vale_transporte"
        | "vale_alimentacao"
        | "hora_extra"
        | "falta_descontada"
        | "bonus"
        | "adiantamento"
        | "reembolso"
        | "desconto_diverso"
        | "outro"
      tipo_prejuizo:
        | "garantia"
        | "peca_danificada"
        | "cliente_sumiu"
        | "fraude_chargeback"
        | "furto_extravio"
        | "cancelamento_com_peca"
        | "outro"
      tipo_vinculo_rh:
        | "clt"
        | "pj"
        | "mei"
        | "diarista"
        | "freelancer"
        | "estagiario"
        | "outro"
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
      acao_hora_excedente: [
        "pendente_decisao",
        "pago_como_extra",
        "mantido_em_banco",
        "compensado",
      ],
      escopo_meta: ["empresa", "tecnico", "loja"],
      forma_pagamento_conta: ["pix", "dinheiro", "cartao", "transferencia"],
      metric_meta: [
        "faturamento",
        "qtd_os",
        "qtd_servicos",
        "ticket_medio",
        "comissao_paga",
        "margem_os",
        "tempo_medio_horas",
        "retrabalho_taxa",
        "aprovacao_orcamento_taxa",
        "retorno_cliente_30d",
      ],
      status_comissao: ["pendente", "liberada", "paga", "estornada"],
      status_conferencia: ["em_andamento", "finalizada"],
      status_conta: ["pendente", "paga", "vencida", "cancelada", "parcial"],
      status_convite_enum: ["pendente", "aceito", "revogado", "expirado"],
      status_estoque_aparelho: [
        "disponivel",
        "em_assistencia",
        "em_transporte",
        "vendido",
      ],
      status_meta: ["ativa", "pausada", "concluida_sucesso", "concluida_falha"],
      status_movimentacao_func: ["pendente", "pago", "estornado"],
      status_ordem: [
        "recebido",
        "em_analise",
        "aguardando_aprovacao",
        "aprovado",
        "em_reparo",
        "aguardando_peca",
        "pronto",
        "entregue",
        "cancelado",
      ],
      status_servico: ["pendente", "em_reparo", "concluido", "cancelado"],
      tipo_cliente: ["lojista_b2b", "consumidor_b2c"],
      tipo_comissao: ["fixa", "percentual", "fixo_por_os", "percentual_lucro"],
      tipo_movimentacao: ["entrada", "saida", "prejuizo"],
      tipo_movimentacao_func: [
        "salario",
        "comissao",
        "vale_transporte",
        "vale_alimentacao",
        "hora_extra",
        "falta_descontada",
        "bonus",
        "adiantamento",
        "reembolso",
        "desconto_diverso",
        "outro",
      ],
      tipo_prejuizo: [
        "garantia",
        "peca_danificada",
        "cliente_sumiu",
        "fraude_chargeback",
        "furto_extravio",
        "cancelamento_com_peca",
        "outro",
      ],
      tipo_vinculo_rh: [
        "clt",
        "pj",
        "mei",
        "diarista",
        "freelancer",
        "estagiario",
        "outro",
      ],
    },
  },
} as const
