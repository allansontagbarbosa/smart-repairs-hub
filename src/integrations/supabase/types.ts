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
      aparelhos: {
        Row: {
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
      clientes: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string
        }
        Relationships: []
      }
      estoque: {
        Row: {
          categoria: string | null
          created_at: string
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
          id?: string
          nome?: string
          preco_custo?: number | null
          preco_venda?: number | null
          quantidade?: number
          quantidade_minima?: number
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
          created_at: string
          custo_pecas: number | null
          data_conclusao: string | null
          data_entrada: string
          data_entrega: string | null
          defeito_relatado: string
          diagnostico: string | null
          id: string
          numero: number
          observacoes: string | null
          previsao_entrega: string | null
          servico_realizado: string | null
          status: Database["public"]["Enums"]["status_ordem"]
          tecnico: string | null
          valor: number | null
        }
        Insert: {
          aparelho_id: string
          created_at?: string
          custo_pecas?: number | null
          data_conclusao?: string | null
          data_entrada?: string
          data_entrega?: string | null
          defeito_relatado: string
          diagnostico?: string | null
          id?: string
          numero?: number
          observacoes?: string | null
          previsao_entrega?: string | null
          servico_realizado?: string | null
          status?: Database["public"]["Enums"]["status_ordem"]
          tecnico?: string | null
          valor?: number | null
        }
        Update: {
          aparelho_id?: string
          created_at?: string
          custo_pecas?: number | null
          data_conclusao?: string | null
          data_entrada?: string
          data_entrega?: string | null
          defeito_relatado?: string
          diagnostico?: string | null
          id?: string
          numero?: number
          observacoes?: string | null
          previsao_entrega?: string | null
          servico_realizado?: string | null
          status?: Database["public"]["Enums"]["status_ordem"]
          tecnico?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_de_servico_aparelho_id_fkey"
            columns: ["aparelho_id"]
            isOneToOne: false
            referencedRelation: "aparelhos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      status_ordem:
        | "recebido"
        | "em_analise"
        | "aguardando_aprovacao"
        | "em_reparo"
        | "pronto"
        | "entregue"
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
      status_ordem: [
        "recebido",
        "em_analise",
        "aguardando_aprovacao",
        "em_reparo",
        "pronto",
        "entregue",
      ],
      tipo_movimentacao: ["entrada", "saida"],
    },
  },
} as const
