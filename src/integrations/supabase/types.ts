export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      booking_audit_log: {
        Row: {
          booking_id: string | null
          created_at: string
          created_by: string | null
          details: Json | null
          error_message: string | null
          id: string
          operation: string
          payment_intent_id: string | null
          status: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          operation: string
          payment_intent_id?: string | null
          status?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          operation?: string
          payment_intent_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      booking_service_modifications: {
        Row: {
          booking_id: string
          created_at: string | null
          description: string | null
          id: string
          modification_type: string
          price_change: number
          service_name: string
          worker_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          modification_type: string
          price_change: number
          service_name: string
          worker_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          modification_type?: string
          price_change?: number
          service_name?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_service_modifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancellation_deadline: string | null
          created_at: string | null
          customer_id: string | null
          guest_customer_info: Json | null
          has_modifications: boolean | null
          id: string
          late_fee_amount: number | null
          late_fee_charged: boolean | null
          location_notes: string | null
          payment_intent_id: string | null
          payment_status: string | null
          pending_payment_amount: number | null
          requires_manual_payment: boolean | null
          scheduled_date: string
          scheduled_start: string
          service_id: string
          status: Database["public"]["Enums"]["booking_status"] | null
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          worker_id: string | null
        }
        Insert: {
          cancellation_deadline?: string | null
          created_at?: string | null
          customer_id?: string | null
          guest_customer_info?: Json | null
          has_modifications?: boolean | null
          id?: string
          late_fee_amount?: number | null
          late_fee_charged?: boolean | null
          location_notes?: string | null
          payment_intent_id?: string | null
          payment_status?: string | null
          pending_payment_amount?: number | null
          requires_manual_payment?: boolean | null
          scheduled_date: string
          scheduled_start: string
          service_id: string
          status?: Database["public"]["Enums"]["booking_status"] | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          worker_id?: string | null
        }
        Update: {
          cancellation_deadline?: string | null
          created_at?: string | null
          customer_id?: string | null
          guest_customer_info?: Json | null
          has_modifications?: boolean | null
          id?: string
          late_fee_amount?: number | null
          late_fee_charged?: boolean | null
          location_notes?: string | null
          payment_intent_id?: string | null
          payment_status?: string | null
          pending_payment_amount?: number | null
          requires_manual_payment?: boolean | null
          scheduled_date?: string
          scheduled_start?: string
          service_id?: string
          status?: Database["public"]["Enums"]["booking_status"] | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
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
      idempotency_records: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          operation_type: string
          request_hash: string
          response_data: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          idempotency_key: string
          operation_type: string
          request_hash: string
          response_data?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          operation_type?: string
          request_hash?: string
          response_data?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          invoice_id: string
          quantity: number
          service_name: string
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id: string
          quantity?: number
          service_name: string
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id?: string
          quantity?: number
          service_name?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          booking_id: string
          business_license: string | null
          created_at: string | null
          customer_id: string
          due_date: string
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          invoice_date: string
          invoice_number: string
          pdf_url: string | null
          state_code: string | null
          status: string
          tax_amount: number | null
          tax_rate: number | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          business_license?: string | null
          created_at?: string | null
          customer_id: string
          due_date?: string
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          pdf_url?: string | null
          state_code?: string | null
          status?: string
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          business_license?: string | null
          created_at?: string | null
          customer_id?: string
          due_date?: string
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          pdf_url?: string | null
          state_code?: string | null
          status?: string
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_charges: {
        Row: {
          amount: number
          booking_id: string
          charge_type: string
          charged_by: string
          created_at: string | null
          description: string | null
          id: string
          processed_at: string | null
          status: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          charge_type: string
          charged_by: string
          created_at?: string | null
          description?: string | null
          id?: string
          processed_at?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          charge_type?: string
          charged_by?: string
          created_at?: string | null
          description?: string | null
          id?: string
          processed_at?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_charges_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
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
          booking_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          message: string
          recipient_number: string
          sent_at: string | null
          status: Database["public"]["Enums"]["sms_status"]
          twilio_sid: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message: string
          recipient_number: string
          sent_at?: string | null
          status: Database["public"]["Enums"]["sms_status"]
          twilio_sid?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message?: string
          recipient_number?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["sms_status"]
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      state_tax_rates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          state_code: string
          state_name: string
          tax_rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          state_code: string
          state_name: string
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          state_code?: string
          state_name?: string
          tax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          booking_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          currency: string | null
          guest_customer_email: string | null
          id: string
          idempotency_key: string
          payment_intent_id: string | null
          payment_method: string | null
          refund_amount: number | null
          status: Database["public"]["Enums"]["payment_status"] | null
          stripe_refund_id: string | null
          transaction_type: string | null
        }
        Insert: {
          amount: number
          booking_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          currency?: string | null
          guest_customer_email?: string | null
          id?: string
          idempotency_key?: string
          payment_intent_id?: string | null
          payment_method?: string | null
          refund_amount?: number | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          stripe_refund_id?: string | null
          transaction_type?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          currency?: string | null
          guest_customer_email?: string | null
          id?: string
          idempotency_key?: string
          payment_intent_id?: string | null
          payment_method?: string | null
          refund_amount?: number | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          stripe_refund_id?: string | null
          transaction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
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
          zip_code: string | null
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
          zip_code?: string | null
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
          zip_code?: string | null
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
      worker_coverage_notifications: {
        Row: {
          booking_id: string
          created_at: string
          distance_priority: number
          id: string
          notification_type: string
          response: string | null
          response_at: string | null
          sent_at: string
          worker_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          distance_priority?: number
          id?: string
          notification_type?: string
          response?: string | null
          response_at?: string | null
          sent_at?: string
          worker_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          distance_priority?: number
          id?: string
          notification_type?: string
          response?: string | null
          response_at?: string | null
          sent_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_coverage_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_coverage_notifications_worker_id_fkey"
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
      auto_assign_workers_with_coverage: {
        Args: { p_booking_id: string }
        Returns: {
          assigned_worker_id: string
          assignment_status: string
          notifications_sent: number
        }[]
      }
      calculate_cancellation_deadline: {
        Args: { scheduled_date: string; scheduled_start: string }
        Returns: string
      }
      cleanup_expired_idempotency_records: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_orphaned_payment_records: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      find_available_workers: {
        Args:
          | {
              job_date: string
              job_time: string
              job_duration: number
              job_region: string
            }
          | {
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
      find_workers_for_coverage: {
        Args: { p_booking_id: string; p_max_distance_priority?: number }
        Returns: {
          worker_id: string
          worker_name: string
          worker_email: string
          worker_phone: string
          distance_priority: number
          customer_zipcode: string
        }[]
      }
      generate_invoice_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_available_time_slots: {
        Args: {
          p_zipcode: string
          p_date: string
          p_service_duration_minutes?: number
        }
        Returns: {
          time_slot: string
          available_workers: number
          worker_ids: string[]
        }[]
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_secret: {
        Args: { secret_name: string }
        Returns: string
      }
      get_tax_rate_by_state: {
        Args: { state_abbreviation: string }
        Returns: number
      }
      resend_worker_sms: {
        Args: { booking_id_param: string }
        Returns: boolean
      }
      respond_to_coverage_request: {
        Args: { p_notification_id: string; p_response: string }
        Returns: boolean
      }
      set_worker_weekly_availability: {
        Args: { p_worker_id: string; p_availability: Json }
        Returns: boolean
      }
    }
    Enums: {
      booking_status:
        | "pending"
        | "payment_pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "authorized"
        | "captured"
      day_of_week:
        | "Sunday"
        | "Monday"
        | "Tuesday"
        | "Wednesday"
        | "Thursday"
        | "Friday"
        | "Saturday"
      payment_status: "pending" | "completed" | "failed" | "authorized"
      session_status: "created" | "paid" | "expired" | "cancelled"
      sms_status: "sent" | "failed"
      user_role: "customer" | "worker" | "admin"
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
      booking_status: [
        "pending",
        "payment_pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "authorized",
        "captured",
      ],
      day_of_week: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      payment_status: ["pending", "completed", "failed", "authorized"],
      session_status: ["created", "paid", "expired", "cancelled"],
      sms_status: ["sent", "failed"],
      user_role: ["customer", "worker", "admin"],
    },
  },
} as const
