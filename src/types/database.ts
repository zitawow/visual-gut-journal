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
      analysis_corrections: {
        Row: {
          corrected_bristol_type: number | null
          corrected_color: string | null
          corrected_shape: string | null
          corrected_texture: string | null
          created_at: string
          entry_id: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          corrected_bristol_type?: number | null
          corrected_color?: string | null
          corrected_shape?: string | null
          corrected_texture?: string | null
          created_at?: string
          entry_id: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          corrected_bristol_type?: number | null
          corrected_color?: string | null
          corrected_shape?: string | null
          corrected_texture?: string | null
          created_at?: string
          entry_id?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_corrections_entry_owner_fk"
            columns: ["entry_id", "user_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "analysis_corrections_entry_owner_fk"
            columns: ["entry_id", "user_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_effective_analysis"
            referencedColumns: ["entry_id", "user_id"]
          },
        ]
      }
      collectibles: {
        Row: {
          collection_id: string
          complexity: number
          created_at: string
          display_id: string
          dna_version: string
          engine_version: string
          entry_id: string
          final_asset_id: string | null
          fluidity: number
          form: string
          generation_id: string
          generation_model: string | null
          generation_provider: string | null
          id: string
          minted_chain: string | null
          minted_contract_address: string | null
          minted_token_id: string | null
          palette: string
          prompt_version: string
          render_contract: Json
          seed: number
          serial: number
          status: string
          trait_fingerprint: string
          traits: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          collection_id?: string
          complexity: number
          created_at?: string
          display_id: string
          dna_version?: string
          engine_version?: string
          entry_id: string
          final_asset_id?: string | null
          fluidity: number
          form: string
          generation_id?: string
          generation_model?: string | null
          generation_provider?: string | null
          id?: string
          minted_chain?: string | null
          minted_contract_address?: string | null
          minted_token_id?: string | null
          palette: string
          prompt_version: string
          render_contract: Json
          seed: number
          serial: number
          status?: string
          trait_fingerprint: string
          traits: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          collection_id?: string
          complexity?: number
          created_at?: string
          display_id?: string
          dna_version?: string
          engine_version?: string
          entry_id?: string
          final_asset_id?: string | null
          fluidity?: number
          form?: string
          generation_id?: string
          generation_model?: string | null
          generation_provider?: string | null
          id?: string
          minted_chain?: string | null
          minted_contract_address?: string | null
          minted_token_id?: string | null
          palette?: string
          prompt_version?: string
          render_contract?: Json
          seed?: number
          serial?: number
          status?: string
          trait_fingerprint?: string
          traits?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collectibles_entry_owner_fk"
            columns: ["entry_id", "user_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "collectibles_entry_owner_fk"
            columns: ["entry_id", "user_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_effective_analysis"
            referencedColumns: ["entry_id", "user_id"]
          },
          {
            foreignKeyName: "collectibles_final_asset_fk"
            columns: ["final_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_events: {
        Row: {
          action: string
          app_version: string | null
          consent_type: string
          document_version: string
          id: string
          occurred_at: string
          source_platform: string
          user_id: string
        }
        Insert: {
          action: string
          app_version?: string | null
          consent_type: string
          document_version: string
          id?: string
          occurred_at?: string
          source_platform: string
          user_id: string
        }
        Update: {
          action?: string
          app_version?: string | null
          consent_type?: string
          document_version?: string
          id?: string
          occurred_at?: string
          source_platform?: string
          user_id?: string
        }
        Relationships: []
      }
      generation_jobs: {
        Row: {
          attempt: number
          collectible_id: string | null
          completed_at: string | null
          cost_currency: string | null
          cost_micros: number | null
          created_at: string
          deduplication_key: string | null
          entry_id: string | null
          error_code: string | null
          error_message: string | null
          id: string
          input_payload: Json
          input_units: number | null
          job_type: string
          max_attempts: number
          model: string | null
          next_retry_at: string | null
          output_payload: Json
          output_units: number | null
          prompt_version: string | null
          provider: string | null
          started_at: string | null
          status: string
          usage_unit: string | null
          user_id: string
        }
        Insert: {
          attempt?: number
          collectible_id?: string | null
          completed_at?: string | null
          cost_currency?: string | null
          cost_micros?: number | null
          created_at?: string
          deduplication_key?: string | null
          entry_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          input_payload?: Json
          input_units?: number | null
          job_type: string
          max_attempts?: number
          model?: string | null
          next_retry_at?: string | null
          output_payload?: Json
          output_units?: number | null
          prompt_version?: string | null
          provider?: string | null
          started_at?: string | null
          status?: string
          usage_unit?: string | null
          user_id: string
        }
        Update: {
          attempt?: number
          collectible_id?: string | null
          completed_at?: string | null
          cost_currency?: string | null
          cost_micros?: number | null
          created_at?: string
          deduplication_key?: string | null
          entry_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          input_payload?: Json
          input_units?: number | null
          job_type?: string
          max_attempts?: number
          model?: string | null
          next_retry_at?: string | null
          output_payload?: Json
          output_units?: number | null
          prompt_version?: string | null
          provider?: string | null
          started_at?: string | null
          status?: string
          usage_unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_collectible_owner_fk"
            columns: ["collectible_id", "user_id"]
            isOneToOne: false
            referencedRelation: "collectibles"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "generation_jobs_entry_owner_fk"
            columns: ["entry_id", "user_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "generation_jobs_entry_owner_fk"
            columns: ["entry_id", "user_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_effective_analysis"
            referencedColumns: ["entry_id", "user_id"]
          },
        ]
      }
      journal_contexts: {
        Row: {
          comfort: string | null
          created_at: string
          entry_id: string
          extra_context: Json
          fiber: string | null
          hydration: string | null
          note: string | null
          sleep_hours: number | null
          stress: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comfort?: string | null
          created_at?: string
          entry_id: string
          extra_context?: Json
          fiber?: string | null
          hydration?: string | null
          note?: string | null
          sleep_hours?: number | null
          stress?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comfort?: string | null
          created_at?: string
          entry_id?: string
          extra_context?: Json
          fiber?: string | null
          hydration?: string | null
          note?: string | null
          sleep_hours?: number | null
          stress?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_contexts_entry_owner_fk"
            columns: ["entry_id", "user_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "journal_contexts_entry_owner_fk"
            columns: ["entry_id", "user_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_effective_analysis"
            referencedColumns: ["entry_id", "user_id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          capture_mime_type: string | null
          capture_operation_key: string | null
          capture_upload_status: string
          created_at: string
          deleted_at: string | null
          id: string
          local_date: string
          occurred_at: string
          source: string
          status: string
          timezone_name: string
          updated_at: string
          upload_expires_at: string | null
          upload_finalized_at: string | null
          user_confirmed: boolean
          user_id: string
        }
        Insert: {
          capture_mime_type?: string | null
          capture_operation_key?: string | null
          capture_upload_status?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          local_date: string
          occurred_at?: string
          source?: string
          status?: string
          timezone_name: string
          updated_at?: string
          upload_expires_at?: string | null
          upload_finalized_at?: string | null
          user_confirmed?: boolean
          user_id: string
        }
        Update: {
          capture_mime_type?: string | null
          capture_operation_key?: string | null
          capture_upload_status?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          local_date?: string
          occurred_at?: string
          source?: string
          status?: string
          timezone_name?: string
          updated_at?: string
          upload_expires_at?: string | null
          upload_finalized_at?: string | null
          user_confirmed?: boolean
          user_id?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          bucket_id: string
          byte_size: number | null
          created_at: string
          deleted_at: string | null
          entry_id: string | null
          height: number | null
          id: string
          kind: string
          mime_type: string
          object_path: string
          perceptual_hash: string | null
          retention_policy: string | null
          retention_requested_at: string | null
          scheduled_delete_at: string | null
          sha256: string | null
          status: string
          user_id: string
          width: number | null
        }
        Insert: {
          bucket_id: string
          byte_size?: number | null
          created_at?: string
          deleted_at?: string | null
          entry_id?: string | null
          height?: number | null
          id?: string
          kind: string
          mime_type: string
          object_path: string
          perceptual_hash?: string | null
          retention_policy?: string | null
          retention_requested_at?: string | null
          scheduled_delete_at?: string | null
          sha256?: string | null
          status?: string
          user_id: string
          width?: number | null
        }
        Update: {
          bucket_id?: string
          byte_size?: number | null
          created_at?: string
          deleted_at?: string | null
          entry_id?: string | null
          height?: number | null
          id?: string
          kind?: string
          mime_type?: string
          object_path?: string
          perceptual_hash?: string | null
          retention_policy?: string | null
          retention_requested_at?: string | null
          scheduled_delete_at?: string | null
          sha256?: string | null
          status?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_entry_owner_fk"
            columns: ["entry_id", "user_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "media_assets_entry_owner_fk"
            columns: ["entry_id", "user_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_effective_analysis"
            referencedColumns: ["entry_id", "user_id"]
          },
        ]
      }
      privacy_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          entry_id: string | null
          failure_reason: string | null
          id: string
          request_type: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          entry_id?: string | null
          failure_reason?: string | null
          id?: string
          request_type: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          entry_id?: string | null
          failure_reason?: string | null
          id?: string
          request_type?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_requests_entry_fk"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_requests_entry_fk"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_effective_analysis"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          display_name: string | null
          id: string
          locale: string
          onboarding_completed_at: string | null
          timezone_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id: string
          locale?: string
          onboarding_completed_at?: string | null
          timezone_name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          locale?: string
          onboarding_completed_at?: string | null
          timezone_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      stool_analyses: {
        Row: {
          analysis_schema_version: string
          bristol_type: number
          color: string
          confidence: number
          confidence_band: string
          created_at: string
          entry_id: string
          generation_job_id: string | null
          id: string
          is_current: boolean
          latency_ms: number | null
          model_name: string | null
          model_version: string | null
          prompt_version: string | null
          provider: string
          provider_metadata: Json
          requires_retake: boolean
          result_status: string
          shape: string
          texture: string
          user_id: string
        }
        Insert: {
          analysis_schema_version?: string
          bristol_type: number
          color: string
          confidence: number
          confidence_band: string
          created_at?: string
          entry_id: string
          generation_job_id?: string | null
          id?: string
          is_current?: boolean
          latency_ms?: number | null
          model_name?: string | null
          model_version?: string | null
          prompt_version?: string | null
          provider: string
          provider_metadata?: Json
          requires_retake?: boolean
          result_status?: string
          shape: string
          texture: string
          user_id: string
        }
        Update: {
          analysis_schema_version?: string
          bristol_type?: number
          color?: string
          confidence?: number
          confidence_band?: string
          created_at?: string
          entry_id?: string
          generation_job_id?: string | null
          id?: string
          is_current?: boolean
          latency_ms?: number | null
          model_name?: string | null
          model_version?: string | null
          prompt_version?: string | null
          provider?: string
          provider_metadata?: Json
          requires_retake?: boolean
          result_status?: string
          shape?: string
          texture?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stool_analyses_entry_owner_fk"
            columns: ["entry_id", "user_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "stool_analyses_entry_owner_fk"
            columns: ["entry_id", "user_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_effective_analysis"
            referencedColumns: ["entry_id", "user_id"]
          },
          {
            foreignKeyName: "stool_analyses_generation_job_owner_fk"
            columns: ["generation_job_id", "user_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      user_milestones: {
        Row: {
          created_at: string
          first_seen_at: string | null
          id: string
          milestone_key: string
          snapshot: Json
          unlocked_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          first_seen_at?: string | null
          id?: string
          milestone_key: string
          snapshot?: Json
          unlocked_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          first_seen_at?: string | null
          id?: string
          milestone_key?: string
          snapshot?: Json
          unlocked_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      journal_entry_effective_analysis: {
        Row: {
          ai_bristol_type: number | null
          ai_color: string | null
          ai_shape: string | null
          ai_texture: string | null
          analysis_schema_version: string | null
          analysis_source: string | null
          confidence: number | null
          confidence_band: string | null
          corrected_bristol_type: number | null
          corrected_color: string | null
          corrected_shape: string | null
          corrected_texture: string | null
          current_analysis_id: string | null
          effective_bristol_type: number | null
          effective_color: string | null
          effective_shape: string | null
          effective_texture: string | null
          entry_id: string | null
          has_bristol_correction: boolean | null
          has_color_correction: boolean | null
          has_shape_correction: boolean | null
          has_texture_correction: boolean | null
          has_user_correction: boolean | null
          local_date: string | null
          model_name: string | null
          model_provider: string | null
          model_version: string | null
          occurred_at: string | null
          prompt_version: string | null
          requires_retake: boolean | null
          timezone_name: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_stool_analysis: {
        Args: { p_analysis_id: string }
        Returns: undefined
      }
      mark_stale_analysis_jobs_manual_required: {
        Args: { p_stale_after?: string }
        Returns: number
      }
      consume_usage_event: {
        Args: { p_user_id: string; p_metric: string; p_window_start: string; p_idempotency_key: string; p_limit: number }
        Returns: boolean
      }
      release_usage_event: {
        Args: { p_user_id: string; p_metric: string; p_window_start: string; p_idempotency_key: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
