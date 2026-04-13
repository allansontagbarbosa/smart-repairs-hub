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
          id: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          ano_mes: string
          created_at?: string
          descricao?: string | null
          id?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ano_mes?: string
          created_at?: string
          descricao?: string | null
          id?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      aparelhos: {
        Row: {
          capacidade: string | null
          cliente_id: string
          cor: string | null
          created_at: string
          id: string
          imei: string | null
          marca: string
          modelo: string
          observacoes: string | null
        }
        Insert: {
          capacidade?: string | null
          cliente_id: string
          cor?: string | null
          created_at?: string
          id?: string
          imei?: string | null
          marca: string
          modelo: string
          observacoes?: string | null
        }
        Update: {
          capacidade?: string | null
          cliente_id?: string
          cor?: string | null
          created_at?: string
          id?: string
          imei?: string | null
          marca?: string
          modelo?: string
          observacoes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aparelhos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      categorias_sistema: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          tipo: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      centros_custo: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cpf: string | null
          created_at: string
          deleted_at: string | null
          documento: string | null
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          status: string
          telefone: string
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          documento?: string | null
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          status?: string
          telefone: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          documento?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          status?: string
          telefone?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      comissoes: {
        Row: {
          created_at: string
          data_pagamento: string | null
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
          funcionario_id: string
          id: string
          tipo_comissao: Database["public"]["Enums"]["tipo_comissao"]
          tipo_servico_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          funcionario_id: string
          id?: string
          tipo_comissao?: Database["public"]["Enums"]["tipo_comissao"]
          tipo_servico_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          funcionario_id?: string
          id?: string
          tipo_comissao?: Database["public"]["Enums"]["tipo_comissao"]
          tipo_servico_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
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
          id: string
          observacoes: string | null
          responsavel: string
          status: Database["public"]["Enums"]["status_conferencia"]
          tipo_conferencia: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          observacoes?: string | null
          responsavel: string
          status?: Database["public"]["Enums"]["status_conferencia"]
          tipo_conferencia?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          observacoes?: string | null
          responsavel?: string
          status?: Database["public"]["Enums"]["status_conferencia"]
          tipo_conferencia?: string | null
          updated_at?: string
        }
        Relationships: []
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
      empresa_config: {
        Row: {
          cidade: string | null
          cnpj_cpf: string | null
          cor_principal: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          formato_data: string | null
          horario_funcionamento: string | null
          id: string
          logo_url: string | null
          moeda: string | null
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          cnpj_cpf?: string | null
          cor_principal?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          formato_data?: string | null
          horario_funcionamento?: string | null
          id?: string
          logo_url?: string | null
          moeda?: string | null
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          cnpj_cpf?: string | null
          cor_principal?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          formato_data?: string | null
          horario_funcionamento?: string | null
          id?: string
          logo_url?: string | null
          moeda?: string | null
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      estoque: {
        Row: {
          categoria: string | null
          created_at: string
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
          fornecedor?: string | null
          id?: string
          nome?: string
          preco_custo?: number | null
          preco_venda?: number | null
          quantidade?: number
          quantidade_minima?: number
        }
        Relationships: []
      }
      estoque_aparelhos: {
        Row: {
          capacidade: string | null
          cor: string | null
          created_at: string
          custo_compra: number | null
          data_entrada: string
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
          fornecedor?: string | null
          id?: string
          imei?: string | null
          localizacao?: string | null
          marca?: string
          modelo?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_estoque_aparelho"]
        }
        Relationships: []
      }
      estoque_categorias: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      estoque_itens: {
        Row: {
          capacidade: string | null
          categoria_id: string | null
          cor: string | null
          created_at: string
          custo_unitario: number | null
          deleted_at: string | null
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
          cor?: string | null
          created_at?: string
          custo_unitario?: number | null
          deleted_at?: string | null
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
          cor?: string | null
          created_at?: string
          custo_unitario?: number | null
          deleted_at?: string | null
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
      formas_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          ativo: boolean
          categoria: string | null
          cnpj_cpf: string | null
          created_at: string
          email: string | null
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
        Relationships: []
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
        Relationships: []
      }
      historico_ordens: {
        Row: {
          created_at: string
          descricao: string | null
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
          id?: string
          observacao?: string | null
          ordem_id?: string
          status_anterior?: string | null
          status_novo?: string
          usuario_responsavel?: string | null
        }
        Relationships: [
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
          fonte?: string
          id?: string
          marca?: string
          modelo?: string
          tac?: string
          updated_at?: string
          vezes_usado?: number
        }
        Relationships: []
      }
      listas_preco: {
        Row: {
          ativo: boolean
          cliente_id: string | null
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cliente_id?: string | null
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cliente_id?: string | null
          created_at?: string
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
        ]
      }
      listas_preco_itens: {
        Row: {
          created_at: string
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
        ]
      }
      marcas: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      modelos: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          created_at: string
          id: string
          marca_id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
          id?: string
          marca_id: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria_id?: string | null
          created_at?: string
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
          id?: string
          observacoes?: string | null
          rodape?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      movimentacoes_financeiras: {
        Row: {
          created_at: string
          data: string
          descricao: string
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
          estoque_id?: string | null
          id?: string
          ordem_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimentacao"]
          valor?: number
        }
        Relationships: [
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
      ordens_de_servico: {
        Row: {
          aparelho_id: string
          aprovacao_orcamento: string | null
          created_at: string
          created_by: string | null
          custo_pecas: number | null
          data_aprovacao: string | null
          data_conclusao: string | null
          data_entrada: string
          data_entrega: string | null
          defeito_relatado: string
          deleted_at: string | null
          diagnostico: string | null
          forma_pagamento_id: string | null
          funcionario_id: string | null
          id: string
          loja_id: string | null
          motivo_reprovacao: string | null
          numero: number
          observacoes: string | null
          prazo_vencido: boolean
          previsao_entrega: string | null
          prioridade: string
          referencia_lote: string | null
          servico_realizado: string | null
          status: Database["public"]["Enums"]["status_ordem"]
          tecnico: string | null
          tipo_servico_id: string | null
          updated_at: string
          updated_by: string | null
          valor: number | null
          valor_pago: number | null
          valor_pendente: number | null
        }
        Insert: {
          aparelho_id: string
          aprovacao_orcamento?: string | null
          created_at?: string
          created_by?: string | null
          custo_pecas?: number | null
          data_aprovacao?: string | null
          data_conclusao?: string | null
          data_entrada?: string
          data_entrega?: string | null
          defeito_relatado: string
          deleted_at?: string | null
          diagnostico?: string | null
          forma_pagamento_id?: string | null
          funcionario_id?: string | null
          id?: string
          loja_id?: string | null
          motivo_reprovacao?: string | null
          numero?: number
          observacoes?: string | null
          prazo_vencido?: boolean
          previsao_entrega?: string | null
          prioridade?: string
          referencia_lote?: string | null
          servico_realizado?: string | null
          status?: Database["public"]["Enums"]["status_ordem"]
          tecnico?: string | null
          tipo_servico_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: number | null
          valor_pago?: number | null
          valor_pendente?: number | null
        }
        Update: {
          aparelho_id?: string
          aprovacao_orcamento?: string | null
          created_at?: string
          created_by?: string | null
          custo_pecas?: number | null
          data_aprovacao?: string | null
          data_conclusao?: string | null
          data_entrada?: string
          data_entrega?: string | null
          defeito_relatado?: string
          deleted_at?: string | null
          diagnostico?: string | null
          forma_pagamento_id?: string | null
          funcionario_id?: string | null
          id?: string
          loja_id?: string | null
          motivo_reprovacao?: string | null
          numero?: number
          observacoes?: string | null
          prazo_vencido?: boolean
          previsao_entrega?: string | null
          prioridade?: string
          referencia_lote?: string | null
          servico_realizado?: string | null
          status?: Database["public"]["Enums"]["status_ordem"]
          tecnico?: string | null
          tipo_servico_id?: string | null
          updated_at?: string
          updated_by?: string | null
          valor?: number | null
          valor_pago?: number | null
          valor_pendente?: number | null
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
            foreignKeyName: "ordens_de_servico_tipo_servico_id_fkey"
            columns: ["tipo_servico_id"]
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
          id: string
          ordem_id: string
          peca_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          custo_unitario?: number
          id?: string
          ordem_id: string
          peca_id: string
          quantidade?: number
        }
        Update: {
          created_at?: string
          custo_unitario?: number
          id?: string
          ordem_id?: string
          peca_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "pecas_utilizadas_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "ordens_de_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pecas_utilizadas_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "estoque"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_acesso: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome_perfil: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome_perfil: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome_perfil?: string
          updated_at?: string
        }
        Relationships: []
      }
      produtos_base: {
        Row: {
          ativo: boolean
          categoria_id: string | null
          created_at: string
          custo: number | null
          descricao: string | null
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
      status_ordem_servico: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          id: string
          nome: string
          ordem_exibicao: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          ordem_exibicao?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          ordem_exibicao?: number
          updated_at?: string
        }
        Relationships: []
      }
      templates_mensagem: {
        Row: {
          ativo: boolean
          created_at: string
          evento: string
          id: string
          mensagem: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          evento: string
          id?: string
          mensagem: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          evento?: string
          id?: string
          mensagem?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      tipos_servico: {
        Row: {
          ativo: boolean
          comissao_padrao: number | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
          valor_padrao: number | null
        }
        Insert: {
          ativo?: boolean
          comissao_padrao?: number | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
          valor_padrao?: number | null
        }
        Update: {
          ativo?: boolean
          comissao_padrao?: number | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
          valor_padrao?: number | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          ativo: boolean
          created_at: string
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
          funcionario_id?: string | null
          id?: string
          nome_exibicao?: string | null
          perfil_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
      is_internal_user: { Args: { _user_id: string }; Returns: boolean }
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
