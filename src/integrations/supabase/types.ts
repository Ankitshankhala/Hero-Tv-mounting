export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      bookings: {
        Row: {
          created_at: string | null
          customer_id: string
          has_modifications: boolean | null
          id: string
          location_notes: string | null
          pending_payment_amount: number | null
          scheduled_date: string
          scheduled_start: string
          service_id: string
          status: Database["public"]["Enums"]["booking_status"] | null
          worker_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          has_modifications?: boolean | null
          id?: string
          location_notes?: string | null
          pending_payment_amount?: number | null
          scheduled_date: string
          scheduled_start: string
          service_id: string
          status?: Database["public"]["Enums"]["booking_status"] | null
          worker_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          has_modifications?: boolean | null
          id?: string
          location_notes?: string | null
          pending_payment_amount?: number | null
          scheduled_date?: string
          scheduled_start?: string
          service_id?: string
          status?: Database["public"]["Enums"]["booking_status"] | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      onsite_charges: {
        Row: {
          added_by: string
          amount: number
          booking_id: string
          created_at: string | null
          description: string
          id: string
        }
        Insert: {
          added_by: string
          amount: number
          booking_id: string
          created_at?: string | null
          description: string
          id?: string
        }
        Update: {
          added_by?: string
          amount?: number
          booking_id?: string
          created_at?: string | null
          description?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onsite_charges_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onsite_charges_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_sessions: {
        Row: {
          created_at: string | null
          id: string
          session_id: string
          status: Database["public"]["Enums"]["session_status"] | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          session_id: string
          status?: Database["public"]["Enums"]["session_status"] | null
          transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          session_id?: string
          status?: Database["public"]["Enums"]["session_status"] | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_sessions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          comments: string | null
          created_at: string | null
          customer_id: string
          id: string
          rating: number
          worker_id: string
        }
        Insert: {
          booking_id: string
          comments?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          rating: number
          worker_id: string
        }
        Update: {
          booking_id?: string
          comments?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          rating?: number
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          base_price: number | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_visible: boolean
          name: string
          sort_order: number
        }
        Insert: {
          base_price?: number | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_visible?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          base_price?: number | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_visible?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          created_at: string | null
          id: string
          message: string
          recipient_number: string
          sent_at: string | null
          status: Database["public"]["Enums"]["sms_status"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          recipient_number: string
          sent_at?: string | null
          status: Database["public"]["Enums"]["sms_status"]
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          recipient_number?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["sms_status"]
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          booking_id: string
          created_at: string | null
          currency: string | null
          id: string
          payment_method: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string | null
          currency?: string | null
          id?: string
          payment_method?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          payment_method?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          city: string | null
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string | null
          phone: string | null
          reason: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          phone?: string | null
          reason?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          phone?: string | null
          reason?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      worker_applications: {
        Row: {
          availability: Json
          background_check_consent: boolean | null
          city: string
          created_at: string | null
          email: string
          experience: string
          has_tools: boolean | null
          has_vehicle: boolean | null
          id: string
          name: string
          phone: string
          region: string
          skills: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          availability?: Json
          background_check_consent?: boolean | null
          city: string
          created_at?: string | null
          email: string
          experience: string
          has_tools?: boolean | null
          has_vehicle?: boolean | null
          id?: string
          name: string
          phone: string
          region: string
          skills?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          availability?: Json
          background_check_consent?: boolean | null
          city?: string
          created_at?: string | null
          email?: string
          experience?: string
          has_tools?: boolean | null
          has_vehicle?: boolean | null
          id?: string
          name?: string
          phone?: string
          region?: string
          skills?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      worker_availability: {
        Row: {
          created_at: string | null
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id: string
          start_time: string
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id?: string
          start_time: string
          worker_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
          end_time?: string
          id?: string
          start_time?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_availability_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_bookings: {
        Row: {
          assigned_at: string | null
          booking_id: string
          created_at: string | null
          id: string
          status: string | null
          worker_id: string
        }
        Insert: {
          assigned_at?: string | null
          booking_id: string
          created_at?: string | null
          id?: string
          status?: string | null
          worker_id: string
        }
        Update: {
          assigned_at?: string | null
          booking_id?: string
          created_at?: string | null
          id?: string
          status?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_bookings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_bookings_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_notifications: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_read: boolean | null
          title: string
          worker_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          title: string
          worker_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          title?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_notifications_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_schedule: {
        Row: {
          created_at: string | null
          end_time: string
          id: string
          start_time: string
          work_date: string
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          end_time: string
          id?: string
          start_time: string
          work_date: string
          worker_id: string
        }
        Update: {
          created_at?: string | null
          end_time?: string
          id?: string
          start_time?: string
          work_date?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_schedule_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_assign_workers_to_booking: {
        Args: { p_booking_id: string }
        Returns: {
          assigned_worker_id: string
          assignment_status: string
        }[]
      }
      find_available_workers: {
        Args: {
          p_zipcode: string
          p_scheduled_date: string
          p_scheduled_start: string
          p_duration_minutes?: number
        }
        Returns: {
          worker_id: string
          worker_name: string
          worker_email: string
          worker_phone: string
          distance_priority: number
        }[]
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      booking_status: "pending" | "confirmed" | "completed" | "cancelled"
      day_of_week:
        | "Sunday"
        | "Monday"
        | "Tuesday"
        | "Wednesday"
        | "Thursday"
        | "Friday"
        | "Saturday"
      payment_status: "pending" | "completed" | "failed"
      session_status: "created" | "paid" | "expired" | "cancelled"
      sms_status: "sent" | "failed"
      user_role: "customer" | "worker" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      booking_status: ["pending", "confirmed", "completed", "cancelled"],
      day_of_week: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      payment_status: ["pending", "completed", "failed"],
      session_status: ["created", "paid", "expired", "cancelled"],
      sms_status: ["sent", "failed"],
      user_role: ["customer", "worker", "admin"],
    },
  },
} as const
