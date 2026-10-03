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
      applicant_reviews: {
        Row: {
          applied_at: string | null
          created_at: string
          decision: Database["public"]["Enums"]["applicant_decision"]
          fit_score: number | null
          headline: string | null
          id: string
          job_id: string
          location: string | null
          name: string | null
          profile_url: string | null
          summary: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["applicant_decision"]
          fit_score?: number | null
          headline?: string | null
          id?: string
          job_id: string
          location?: string | null
          name?: string | null
          profile_url?: string | null
          summary?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          decision?: Database["public"]["Enums"]["applicant_decision"]
          fit_score?: number | null
          headline?: string | null
          id?: string
          job_id?: string
          location?: string | null
          name?: string | null
          profile_url?: string | null
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applicant_reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      exec_info_audit: {
        Row: {
          action: string
          created_at: string
          id: string
          label: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          label?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          label?: string | null
          user_id?: string
        }
        Relationships: []
      }
      exec_info_fields: {
        Row: {
          field_key: string
          id: string
          is_secret: boolean
          section: string
          updated_at: string
          user_id: string
          value_cipher: string | null
          value_plain: string | null
        }
        Insert: {
          field_key: string
          id?: string
          is_secret?: boolean
          section: string
          updated_at?: string
          user_id: string
          value_cipher?: string | null
          value_plain?: string | null
        }
        Update: {
          field_key?: string
          id?: string
          is_secret?: boolean
          section?: string
          updated_at?: string
          user_id?: string
          value_cipher?: string | null
          value_plain?: string | null
        }
        Relationships: []
      }
      exec_info_rows: {
        Row: {
          created_at: string
          data: Json
          id: string
          kind: string
          position: number
          secret_cipher: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          kind: string
          position?: number
          secret_cipher?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          position?: number
          secret_cipher?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exec_info_session: {
        Row: {
          last_active_at: string
          user_id: string
        }
        Insert: {
          last_active_at: string
          user_id: string
        }
        Update: {
          last_active_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          nonce: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          nonce: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          nonce?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      google_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          created_at: string
          id: string
          must_haves: string | null
          nice_to_haves: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          must_haves?: string | null
          nice_to_haves?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          must_haves?: string | null
          nice_to_haves?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          font_choice: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          font_choice?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          font_choice?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_steps: {
        Row: {
          body: string
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_steps_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          assigned_to_name: string | null
          calendar_event_id: string | null
          category: Database["public"]["Enums"]["task_category"] | null
          completed_at: string | null
          created_at: string
          delegated_to_contact_id: string | null
          due_date: string | null
          due_time: string | null
          id: string
          last_followup_at: string | null
          next_followup_reminder_at: string | null
          next_step: string | null
          notes: string | null
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          raw_transcript: string | null
          recurrence_days: string[]
          recurrence_end_date: string | null
          recurrence_interval: number
          recurrence_type: Database["public"]["Enums"]["task_recurrence_type"]
          source: Database["public"]["Enums"]["task_source"]
          source_type: Database["public"]["Enums"]["task_source_type"]
          status: Database["public"]["Enums"]["task_status"]
          status_updated_at: string
          title: string
          updated_at: string
          user_id: string
          voice_note_url: string | null
        }
        Insert: {
          assigned_to?: string | null
          assigned_to_name?: string | null
          calendar_event_id?: string | null
          category?: Database["public"]["Enums"]["task_category"] | null
          completed_at?: string | null
          created_at?: string
          delegated_to_contact_id?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          last_followup_at?: string | null
          next_followup_reminder_at?: string | null
          next_step?: string | null
          notes?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          raw_transcript?: string | null
          recurrence_days?: string[]
          recurrence_end_date?: string | null
          recurrence_interval?: number
          recurrence_type?: Database["public"]["Enums"]["task_recurrence_type"]
          source?: Database["public"]["Enums"]["task_source"]
          source_type?: Database["public"]["Enums"]["task_source_type"]
          status?: Database["public"]["Enums"]["task_status"]
          status_updated_at?: string
          title: string
          updated_at?: string
          user_id: string
          voice_note_url?: string | null
        }
        Update: {
          assigned_to?: string | null
          assigned_to_name?: string | null
          calendar_event_id?: string | null
          category?: Database["public"]["Enums"]["task_category"] | null
          completed_at?: string | null
          created_at?: string
          delegated_to_contact_id?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          last_followup_at?: string | null
          next_followup_reminder_at?: string | null
          next_step?: string | null
          notes?: string | null
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          raw_transcript?: string | null
          recurrence_days?: string[]
          recurrence_end_date?: string | null
          recurrence_interval?: number
          recurrence_type?: Database["public"]["Enums"]["task_recurrence_type"]
          source?: Database["public"]["Enums"]["task_source"]
          source_type?: Database["public"]["Enums"]["task_source_type"]
          status?: Database["public"]["Enums"]["task_status"]
          status_updated_at?: string
          title?: string
          updated_at?: string
          user_id?: string
          voice_note_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_delegated_to_contact_id_fkey"
            columns: ["delegated_to_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
      applicant_decision: "Keep" | "Pass" | "Maybe" | "Undecided"
      task_category:
        | "Travel"
        | "Household"
        | "Scheduling"
        | "Errands"
        | "Gifts/Events"
        | "Finance"
        | "Vendors"
        | "Other"
      task_priority: "Normal" | "Important" | "Urgent"
      task_recurrence_type: "none" | "daily" | "weekly" | "monthly"
      task_source: "From Boss" | "Delegated by Me" | "Personal Reminder"
      task_source_type: "Typed" | "Voice"
      task_status:
        | "Not Started"
        | "In Progress"
        | "Waiting on Someone"
        | "Complete"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      applicant_decision: ["Keep", "Pass", "Maybe", "Undecided"],
      task_category: [
        "Travel",
        "Household",
        "Scheduling",
        "Errands",
        "Gifts/Events",
        "Finance",
        "Vendors",
        "Other",
      ],
      task_priority: ["Normal", "Important", "Urgent"],
      task_recurrence_type: ["none", "daily", "weekly", "monthly"],
      task_source: ["From Boss", "Delegated by Me", "Personal Reminder"],
      task_source_type: ["Typed", "Voice"],
      task_status: [
        "Not Started",
        "In Progress",
        "Waiting on Someone",
        "Complete",
      ],
    },
  },
} as const
