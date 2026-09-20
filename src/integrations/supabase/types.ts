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
      account_pockets: {
        Row: {
          account_id: string
          created_at: string
          id: string
          kind: string
          name: string
          opening_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          kind?: string
          name: string
          opening_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          opening_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_pockets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          currency: string | null
          icon: string | null
          id: string
          name: string
          opening_balance: number
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          currency?: string | null
          icon?: string | null
          id?: string
          name: string
          opening_balance?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          currency?: string | null
          icon?: string | null
          id?: string
          name?: string
          opening_balance?: number
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      body_stats: {
        Row: {
          birthdate: string | null
          created_at: string
          height_cm: number | null
          id: string
          notes: string | null
          target_weight_kg: number | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          birthdate?: string | null
          created_at?: string
          height_cm?: number | null
          id?: string
          notes?: string | null
          target_weight_kg?: number | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          birthdate?: string | null
          created_at?: string
          height_cm?: number | null
          id?: string
          notes?: string | null
          target_weight_kg?: number | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      capabilities: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_reviews: {
        Row: {
          challenges: string | null
          created_at: string
          gratitude: string | null
          id: string
          mood: number | null
          review_date: string
          tomorrow_focus: string | null
          updated_at: string
          user_id: string
          wins: string | null
        }
        Insert: {
          challenges?: string | null
          created_at?: string
          gratitude?: string | null
          id?: string
          mood?: number | null
          review_date?: string
          tomorrow_focus?: string | null
          updated_at?: string
          user_id: string
          wins?: string | null
        }
        Update: {
          challenges?: string | null
          created_at?: string
          gratitude?: string | null
          id?: string
          mood?: number | null
          review_date?: string
          tomorrow_focus?: string | null
          updated_at?: string
          user_id?: string
          wins?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          end_at: string | null
          id: string
          start_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_at?: string | null
          id?: string
          start_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_at?: string | null
          id?: string
          start_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      evidence: {
        Row: {
          capability_id: string | null
          created_at: string
          goal_id: string | null
          id: string
          note: string | null
          project_id: string | null
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          capability_id?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          note?: string | null
          project_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          capability_id?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          note?: string | null
          project_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          kind: Database["public"]["Enums"]["category_kind"]
          monthly_budget: number | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          monthly_budget?: number | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["category_kind"]
          monthly_budget?: number | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      food_logs: {
        Row: {
          calories: number
          carbs_g: number | null
          created_at: string
          fat_g: number | null
          food_id: string | null
          id: string
          log_date: string
          meal: string | null
          name: string | null
          protein_g: number | null
          servings: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calories: number
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          food_id?: string | null
          id?: string
          log_date?: string
          meal?: string | null
          name?: string | null
          protein_g?: number | null
          servings?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calories?: number
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          food_id?: string | null
          id?: string
          log_date?: string
          meal?: string | null
          name?: string | null
          protein_g?: number | null
          servings?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_logs_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          calories: number
          carbs_g: number | null
          created_at: string
          fat_g: number | null
          icon: string | null
          id: string
          name: string
          protein_g: number | null
          serving_grams: number | null
          serving_label: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calories: number
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          icon?: string | null
          id?: string
          name: string
          protein_g?: number | null
          serving_grams?: number | null
          serving_label?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calories?: number
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          icon?: string | null
          id?: string
          name?: string
          protein_g?: number | null
          serving_grams?: number | null
          serving_label?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          category: string | null
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          name: string
          progress: number
          project_id: string | null
          status: Database["public"]["Enums"]["goal_status"]
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          progress?: number
          project_id?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          progress?: number
          project_id?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          created_at: string
          habit_id: string
          id: string
          log_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          habit_id: string
          id?: string
          log_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          habit_id?: string
          id?: string
          log_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          description: string | null
          frequency: Database["public"]["Enums"]["habit_frequency"]
          icon: string | null
          id: string
          name: string
          target: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          frequency?: Database["public"]["Enums"]["habit_frequency"]
          icon?: string | null
          id?: string
          name: string
          target?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          frequency?: Database["public"]["Enums"]["habit_frequency"]
          icon?: string | null
          id?: string
          name?: string
          target?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      health_logs: {
        Row: {
          actual_sleep_minutes: number | null
          awake_minutes: number | null
          blood_oxygen_avg: number | null
          created_at: string
          deep_sleep_minutes: number | null
          food_categories: string[] | null
          food_quality: number | null
          heart_rate_avg: number | null
          id: string
          light_sleep_minutes: number | null
          log_date: string
          mood: number | null
          note: string | null
          rem_sleep_minutes: number | null
          respiratory_rate_avg: number | null
          sleep_end_at: string | null
          sleep_hours: number | null
          sleep_latency_minutes: number | null
          sleep_score: number | null
          sleep_source: string | null
          sleep_start_at: string | null
          stress_level: number | null
          time_in_bed_minutes: number | null
          trained: boolean | null
          updated_at: string
          user_id: string
          water_ok: boolean | null
        }
        Insert: {
          actual_sleep_minutes?: number | null
          awake_minutes?: number | null
          blood_oxygen_avg?: number | null
          created_at?: string
          deep_sleep_minutes?: number | null
          food_categories?: string[] | null
          food_quality?: number | null
          heart_rate_avg?: number | null
          id?: string
          light_sleep_minutes?: number | null
          log_date?: string
          mood?: number | null
          note?: string | null
          rem_sleep_minutes?: number | null
          respiratory_rate_avg?: number | null
          sleep_end_at?: string | null
          sleep_hours?: number | null
          sleep_latency_minutes?: number | null
          sleep_score?: number | null
          sleep_source?: string | null
          sleep_start_at?: string | null
          stress_level?: number | null
          time_in_bed_minutes?: number | null
          trained?: boolean | null
          updated_at?: string
          user_id: string
          water_ok?: boolean | null
        }
        Update: {
          actual_sleep_minutes?: number | null
          awake_minutes?: number | null
          blood_oxygen_avg?: number | null
          created_at?: string
          deep_sleep_minutes?: number | null
          food_categories?: string[] | null
          food_quality?: number | null
          heart_rate_avg?: number | null
          id?: string
          light_sleep_minutes?: number | null
          log_date?: string
          mood?: number | null
          note?: string | null
          rem_sleep_minutes?: number | null
          respiratory_rate_avg?: number | null
          sleep_end_at?: string | null
          sleep_hours?: number | null
          sleep_latency_minutes?: number | null
          sleep_score?: number | null
          sleep_source?: string | null
          sleep_start_at?: string | null
          stress_level?: number | null
          time_in_bed_minutes?: number | null
          trained?: boolean | null
          updated_at?: string
          user_id?: string
          water_ok?: boolean | null
        }
        Relationships: []
      }
      medication_logs: {
        Row: {
          created_at: string
          id: string
          log_date: string
          medication_id: string
          taken: boolean
          time_slot: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          log_date?: string
          medication_id: string
          taken?: boolean
          time_slot: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          log_date?: string
          medication_id?: string
          taken?: boolean
          time_slot?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          active: boolean
          created_at: string
          dosage: string | null
          id: string
          name: string
          notes: string | null
          schedule_times: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dosage?: string | null
          id?: string
          name: string
          notes?: string | null
          schedule_times?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dosage?: string | null
          id?: string
          name?: string
          notes?: string | null
          schedule_times?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          body: string | null
          body_format: string
          created_at: string
          id: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          body_format?: string
          created_at?: string
          id?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          body_format?: string
          created_at?: string
          id?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payday_config: {
        Row: {
          anchor_date: string | null
          created_at: string
          expected_net_amount: number | null
          id: string
          interval_weeks: number | null
          pay_day: number | null
          safety_buffer: number | null
          schedule: Database["public"]["Enums"]["payday_schedule"]
          updated_at: string
          user_id: string
        }
        Insert: {
          anchor_date?: string | null
          created_at?: string
          expected_net_amount?: number | null
          id?: string
          interval_weeks?: number | null
          pay_day?: number | null
          safety_buffer?: number | null
          schedule?: Database["public"]["Enums"]["payday_schedule"]
          updated_at?: string
          user_id: string
        }
        Update: {
          anchor_date?: string | null
          created_at?: string
          expected_net_amount?: number | null
          id?: string
          interval_weeks?: number | null
          pay_day?: number | null
          safety_buffer?: number | null
          schedule?: Database["public"]["Enums"]["payday_schedule"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prayer_logs: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          on_time: boolean | null
          prayer_date: string
          prayer_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          on_time?: boolean | null
          prayer_date?: string
          prayer_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          on_time?: boolean | null
          prayer_date?: string
          prayer_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prayer_settings: {
        Row: {
          asr_school: string | null
          calc_method: string | null
          city: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asr_school?: string | null
          calc_method?: string | null
          city?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asr_school?: string | null
          calc_method?: string | null
          city?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          due_date: string | null
          icon: string | null
          id: string
          image_url: string | null
          name: string
          priority: Database["public"]["Enums"]["priority_level"]
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          priority?: Database["public"]["Enums"]["priority_level"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_costs: {
        Row: {
          account_id: string | null
          active: boolean
          amount: number
          category_id: string | null
          created_at: string
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id: string
          interval_count: number
          interval_unit: Database["public"]["Enums"]["interval_unit"] | null
          name: string
          next_due_at: string | null
          next_due_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          amount: number
          category_id?: string | null
          created_at?: string
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          interval_count?: number
          interval_unit?: Database["public"]["Enums"]["interval_unit"] | null
          name: string
          next_due_at?: string | null
          next_due_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          amount?: number
          category_id?: string | null
          created_at?: string
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          interval_count?: number
          interval_unit?: Database["public"]["Enums"]["interval_unit"] | null
          name?: string
          next_due_at?: string | null
          next_due_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_costs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_costs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_readings: {
        Row: {
          created_at: string
          id: string
          note: string | null
          reading: number
          reading_at: string
          resource_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          reading: number
          reading_at?: string
          resource_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          reading?: number
          reading_at?: string
          resource_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_readings_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          account_id: string | null
          active: boolean
          category_id: string | null
          color: string | null
          created_at: string
          cycle_count: number
          cycle_days: number | null
          cycle_start_date: string | null
          cycle_unit: string
          icon: string | null
          id: string
          kind: Database["public"]["Enums"]["resource_kind"]
          name: string
          quota_amount: number | null
          unit: string
          unit_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          category_id?: string | null
          color?: string | null
          created_at?: string
          cycle_count?: number
          cycle_days?: number | null
          cycle_start_date?: string | null
          cycle_unit?: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["resource_kind"]
          name: string
          quota_amount?: number | null
          unit: string
          unit_cost?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          category_id?: string | null
          color?: string | null
          created_at?: string
          cycle_count?: number
          cycle_days?: number | null
          cycle_start_date?: string | null
          cycle_unit?: string
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["resource_kind"]
          name?: string
          quota_amount?: number | null
          unit?: string
          unit_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      task_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          note: string | null
          planned_minutes: number | null
          started_at: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          note?: string | null
          planned_minutes?: number | null
          started_at?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          note?: string | null
          planned_minutes?: number | null
          started_at?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          capability_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimate_unit: string
          estimated_minutes: number | null
          goal_id: string | null
          id: string
          last_postponed_at: string | null
          max_date: string | null
          original_due_date: string | null
          parent_task_id: string | null
          position: number
          postponed_count: number
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          capability_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimate_unit?: string
          estimated_minutes?: number | null
          goal_id?: string | null
          id?: string
          last_postponed_at?: string | null
          max_date?: string | null
          original_due_date?: string | null
          parent_task_id?: string | null
          position?: number
          postponed_count?: number
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          capability_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimate_unit?: string
          estimated_minutes?: number | null
          goal_id?: string | null
          id?: string
          last_postponed_at?: string | null
          max_date?: string | null
          original_due_date?: string | null
          parent_task_id?: string | null
          position?: number
          postponed_count?: number
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_capability_id_fkey"
            columns: ["capability_id"]
            isOneToOne: false
            referencedRelation: "capabilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          pocket_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["transaction_kind"]
          pocket_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["transaction_kind"]
          pocket_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_pocket_id_fkey"
            columns: ["pocket_id"]
            isOneToOne: false
            referencedRelation: "account_pockets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          currency: string | null
          date_format: string
          dimension_order: string[] | null
          enabled_modules: string[]
          id: string
          onboarding_completed_at: string | null
          time_format: string
          unit_system: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          date_format?: string
          dimension_order?: string[] | null
          enabled_modules?: string[]
          id?: string
          onboarding_completed_at?: string | null
          time_format?: string
          unit_system?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          date_format?: string
          dimension_order?: string[] | null
          enabled_modules?: string[]
          id?: string
          onboarding_completed_at?: string | null
          time_format?: string
          unit_system?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicle_logs: {
        Row: {
          cost: number | null
          created_at: string
          description: string | null
          fuel_amount: number | null
          full_tank: boolean | null
          id: string
          kind: string
          log_date: string
          next_service_date: string | null
          next_service_odometer: number | null
          odometer: number | null
          transaction_id: string | null
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description?: string | null
          fuel_amount?: number | null
          full_tank?: boolean | null
          id?: string
          kind?: string
          log_date?: string
          next_service_date?: string | null
          next_service_odometer?: number | null
          odometer?: number | null
          transaction_id?: string | null
          updated_at?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string | null
          fuel_amount?: number | null
          full_tank?: boolean | null
          id?: string
          kind?: string
          log_date?: string
          next_service_date?: string | null
          next_service_odometer?: number | null
          odometer?: number | null
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          account_id: string | null
          active: boolean
          category_id: string | null
          color: string | null
          created_at: string
          fuel_unit: string
          icon: string | null
          id: string
          make: string | null
          model: string | null
          name: string
          odometer_unit: string
          plate: string | null
          updated_at: string
          user_id: string
          year: number | null
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          category_id?: string | null
          color?: string | null
          created_at?: string
          fuel_unit?: string
          icon?: string | null
          id?: string
          make?: string | null
          model?: string | null
          name: string
          odometer_unit?: string
          plate?: string | null
          updated_at?: string
          user_id: string
          year?: number | null
        }
        Update: {
          account_id?: string | null
          active?: boolean
          category_id?: string | null
          color?: string | null
          created_at?: string
          fuel_unit?: string
          icon?: string | null
          id?: string
          make?: string | null
          model?: string | null
          name?: string
          odometer_unit?: string
          plate?: string | null
          updated_at?: string
          user_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
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
      account_type: "checking" | "savings" | "cash" | "credit"
      category_kind: "expense" | "income"
      goal_status: "not_started" | "active" | "completed" | "archived"
      habit_frequency: "daily" | "weekly"
      interval_unit: "hour" | "day" | "week" | "month" | "year"
      payday_schedule: "monthly" | "interval"
      priority_level: "low" | "medium" | "high" | "critical"
      project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "archived"
      recurrence_frequency:
        | "weekly"
        | "monthly"
        | "yearly"
        | "daily"
        | "hourly"
        | "custom"
      resource_kind: "meter" | "quota"
      task_status:
        | "inbox"
        | "todo"
        | "in_progress"
        | "waiting"
        | "completed"
        | "cancelled"
      transaction_kind: "expense" | "income" | "adjustment"
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
      account_type: ["checking", "savings", "cash", "credit"],
      category_kind: ["expense", "income"],
      goal_status: ["not_started", "active", "completed", "archived"],
      habit_frequency: ["daily", "weekly"],
      interval_unit: ["hour", "day", "week", "month", "year"],
      payday_schedule: ["monthly", "interval"],
      priority_level: ["low", "medium", "high", "critical"],
      project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "archived",
      ],
      recurrence_frequency: [
        "weekly",
        "monthly",
        "yearly",
        "daily",
        "hourly",
        "custom",
      ],
      resource_kind: ["meter", "quota"],
      task_status: [
        "inbox",
        "todo",
        "in_progress",
        "waiting",
        "completed",
        "cancelled",
      ],
      transaction_kind: ["expense", "income", "adjustment"],
    },
  },
} as const
