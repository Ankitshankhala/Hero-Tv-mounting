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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_alerts: {
        Row: {
          alert_type: string
          booking_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          message: string
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          updated_at: string | null
        }
        Insert: {
          alert_type: string
          booking_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          message: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          updated_at?: string | null
        }
        Update: {
          alert_type?: string
          booking_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          message?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_alerts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_alerts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_payment_status_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_alerts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_status_inconsistencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_alerts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_missing_transactions"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "admin_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_impersonation_sessions: {
        Row: {
          admin_id: string
          created_at: string
          ended_at: string | null
          id: string
          ip_address: string | null
          reason: string | null
          started_at: string
          updated_at: string
          user_agent: string | null
          worker_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          started_at?: string
          updated_at?: string
          user_agent?: string | null
          worker_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          reason?: string | null
          started_at?: string
          updated_at?: string
          user_agent?: string | null
          worker_id?: string
        }
        Relationships: []
      }
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
      booking_services: {
        Row: {
          base_price: number
          booking_id: string
          configuration: Json | null
          created_at: string
          id: string
          quantity: number
          service_id: string
          service_name: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          booking_id: string
          configuration?: Json | null
          created_at?: string
          id?: string
          quantity?: number
          service_id: string
          service_name: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          booking_id?: string
          configuration?: Json | null
          created_at?: string
          id?: string
          quantity?: number
          service_id?: string
          service_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_booking_services_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_booking_services_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_payment_status_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_booking_services_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_status_inconsistencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_booking_services_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_missing_transactions"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      bookings: {
        Row: {
          archived_at: string | null
          cancellation_deadline: string | null
          confirmation_email_sent: boolean | null
          created_at: string | null
          customer_id: string | null
          guest_customer_info: Json | null
          has_modifications: boolean | null
          id: string
          is_archived: boolean | null
          late_fee_amount: number | null
          late_fee_charged: boolean | null
          local_service_date: string | null
          local_service_time: string | null
          location_notes: string | null
          payment_intent_id: string | null
          payment_status: string | null
          pending_payment_amount: number | null
          preferred_worker_id: string | null
          requires_manual_payment: boolean | null
          reservation_expires_at: string | null
          reserved_worker_id: string | null
          scheduled_date: string
          scheduled_start: string
          service_id: string
          service_tz: string | null
          start_time_utc: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          tip_amount: number | null
          updated_at: string | null
          worker_assignment_email_sent: boolean
          worker_id: string | null
        }
        Insert: {
          archived_at?: string | null
          cancellation_deadline?: string | null
          confirmation_email_sent?: boolean | null
          created_at?: string | null
          customer_id?: string | null
          guest_customer_info?: Json | null
          has_modifications?: boolean | null
          id?: string
          is_archived?: boolean | null
          late_fee_amount?: number | null
          late_fee_charged?: boolean | null
          local_service_date?: string | null
          local_service_time?: string | null
          location_notes?: string | null
          payment_intent_id?: string | null
          payment_status?: string | null
          pending_payment_amount?: number | null
          preferred_worker_id?: string | null
          requires_manual_payment?: boolean | null
          reservation_expires_at?: string | null
          reserved_worker_id?: string | null
          scheduled_date: string
          scheduled_start: string
          service_id: string
          service_tz?: string | null
          start_time_utc?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          tip_amount?: number | null
          updated_at?: string | null
          worker_assignment_email_sent?: boolean
          worker_id?: string | null
        }
        Update: {
          archived_at?: string | null
          cancellation_deadline?: string | null
          confirmation_email_sent?: boolean | null
          created_at?: string | null
          customer_id?: string | null
          guest_customer_info?: Json | null
          has_modifications?: boolean | null
          id?: string
          is_archived?: boolean | null
          late_fee_amount?: number | null
          late_fee_charged?: boolean | null
          local_service_date?: string | null
          local_service_time?: string | null
          location_notes?: string | null
          payment_intent_id?: string | null
          payment_status?: string | null
          pending_payment_amount?: number | null
          preferred_worker_id?: string | null
          requires_manual_payment?: boolean | null
          reservation_expires_at?: string | null
          reserved_worker_id?: string | null
          scheduled_date?: string
          scheduled_start?: string
          service_id?: string
          service_tz?: string | null
          start_time_utc?: string | null
          status?: Database["public"]["Enums"]["booking_status"] | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          tip_amount?: number | null
          updated_at?: string | null
          worker_assignment_email_sent?: boolean
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
            foreignKeyName: "bookings_reserved_worker_id_fkey"
            columns: ["reserved_worker_id"]
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
      email_logs: {
        Row: {
          booking_id: string | null
          created_at: string
          email_type: string | null
          error_message: string | null
          external_id: string | null
          id: string
          message: string
          recipient_email: string
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          email_type?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          message: string
          recipient_email: string
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          email_type?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          message?: string
          recipient_email?: string
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
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
      invoice_audit_log: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          invoice_id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          invoice_id: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_audit_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_audit_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_payment_reconciliation"
            referencedColumns: ["invoice_id"]
          },
        ]
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
            foreignKeyName: "fk_invoice_items_invoice"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_items_invoice"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_payment_reconciliation"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "v_invoice_payment_reconciliation"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          last_value: number
          updated_at: string
          year: number
        }
        Insert: {
          last_value?: number
          updated_at?: string
          year: number
        }
        Update: {
          last_value?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      invoice_service_modifications: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          modification_type: string
          new_configuration: Json | null
          old_configuration: Json | null
          price_change: number
          service_name: string
          worker_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          modification_type: string
          new_configuration?: Json | null
          old_configuration?: Json | null
          price_change?: number
          service_name: string
          worker_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          modification_type?: string
          new_configuration?: Json | null
          old_configuration?: Json | null
          price_change?: number
          service_name?: string
          worker_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          booking_id: string
          business_license: string | null
          created_at: string | null
          customer_id: string | null
          delivery_attempts: number | null
          delivery_status: string | null
          due_date: string
          email_attempts: number | null
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          invoice_date: string
          invoice_number: string
          last_delivery_attempt: string | null
          last_email_attempt: string | null
          pdf_generated: boolean | null
          pdf_generated_at: string | null
          pdf_storage_path: string | null
          pdf_url: string | null
          state_code: string | null
          status: string
          tax_amount: number | null
          tax_rate: number | null
          total_amount: number
          updated_at: string | null
          void_at: string | null
          void_reason: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          business_license?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivery_attempts?: number | null
          delivery_status?: string | null
          due_date?: string
          email_attempts?: number | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          last_delivery_attempt?: string | null
          last_email_attempt?: string | null
          pdf_generated?: boolean | null
          pdf_generated_at?: string | null
          pdf_storage_path?: string | null
          pdf_url?: string | null
          state_code?: string | null
          status?: string
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount: number
          updated_at?: string | null
          void_at?: string | null
          void_reason?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          business_license?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivery_attempts?: number | null
          delivery_status?: string | null
          due_date?: string
          email_attempts?: number | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          last_delivery_attempt?: string | null
          last_email_attempt?: string | null
          pdf_generated?: boolean | null
          pdf_generated_at?: string | null
          pdf_storage_path?: string | null
          pdf_url?: string | null
          state_code?: string | null
          status?: string
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number
          updated_at?: string | null
          void_at?: string | null
          void_reason?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoices_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_payment_status_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_status_inconsistencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_missing_transactions"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_payment_status_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_status_inconsistencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_missing_transactions"
            referencedColumns: ["booking_id"]
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
      notification_settings: {
        Row: {
          created_at: string
          id: string
          sms_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          sms_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          sms_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      rls_debug_logs: {
        Row: {
          auth_uid: string | null
          created_at: string | null
          debug_data: Json | null
          id: string
          operation: string
          policy_result: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          auth_uid?: string | null
          created_at?: string | null
          debug_data?: Json | null
          id?: string
          operation: string
          policy_result?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          auth_uid?: string | null
          created_at?: string | null
          debug_data?: Json | null
          id?: string
          operation?: string
          policy_result?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      service_area_audit_logs: {
        Row: {
          area_name: string | null
          change_summary: string | null
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string
          table_name: string
          worker_id: string
        }
        Insert: {
          area_name?: string | null
          change_summary?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id: string
          table_name: string
          worker_id: string
        }
        Update: {
          area_name?: string | null
          change_summary?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string
          table_name?: string
          worker_id?: string
        }
        Relationships: []
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
          recipient_name: string | null
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
          recipient_name?: string | null
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
          recipient_name?: string | null
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
          {
            foreignKeyName: "sms_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_payment_status_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_status_inconsistencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_missing_transactions"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
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
      stripe_customers: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          stripe_customer_id: string
          stripe_default_payment_method_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          stripe_customer_id: string
          stripe_default_payment_method_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          stripe_customer_id?: string
          stripe_default_payment_method_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tip_sync_log: {
        Row: {
          booking_id: string
          id: string
          synced_at: string | null
          tip_amount: number
          transaction_id: string
        }
        Insert: {
          booking_id: string
          id?: string
          synced_at?: string | null
          tip_amount: number
          transaction_id: string
        }
        Update: {
          booking_id?: string
          id?: string
          synced_at?: string | null
          tip_amount?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tip_sync_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_sync_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_payment_status_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_sync_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_status_inconsistencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tip_sync_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_missing_transactions"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "tip_sync_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          base_amount: number | null
          booking_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          captured_at: string | null
          captured_by: string | null
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
          tip_amount: number | null
          transaction_type: string | null
        }
        Insert: {
          amount: number
          base_amount?: number | null
          booking_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          captured_at?: string | null
          captured_by?: string | null
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
          tip_amount?: number | null
          transaction_type?: string | null
        }
        Update: {
          amount?: number
          base_amount?: number | null
          booking_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          captured_at?: string | null
          captured_by?: string | null
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
          tip_amount?: number | null
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
            foreignKeyName: "transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_payment_status_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_status_inconsistencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_missing_transactions"
            referencedColumns: ["booking_id"]
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
      us_zcta_polygons: {
        Row: {
          created_at: string | null
          geom: unknown
          id: string
          land_area: number | null
          water_area: number | null
          zcta5ce: string
        }
        Insert: {
          created_at?: string | null
          geom: unknown
          id?: string
          land_area?: number | null
          water_area?: number | null
          zcta5ce: string
        }
        Update: {
          created_at?: string | null
          geom?: unknown
          id?: string
          land_area?: number | null
          water_area?: number | null
          zcta5ce?: string
        }
        Relationships: []
      }
      us_zip_codes: {
        Row: {
          city: string
          created_at: string | null
          latitude: number | null
          longitude: number | null
          state: string
          state_abbr: string
          zipcode: string
        }
        Insert: {
          city: string
          created_at?: string | null
          latitude?: number | null
          longitude?: number | null
          state: string
          state_abbr: string
          zipcode: string
        }
        Update: {
          city?: string
          created_at?: string | null
          latitude?: number | null
          longitude?: number | null
          state?: string
          state_abbr?: string
          zipcode?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          city: string | null
          created_at: string | null
          email: string
          has_saved_card: boolean
          id: string
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string | null
          phone: string | null
          reason: string | null
          role: Database["public"]["Enums"]["user_role"]
          stripe_customer_id: string | null
          stripe_default_payment_method_id: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          email: string
          has_saved_card?: boolean
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          phone?: string | null
          reason?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          stripe_customer_id?: string | null
          stripe_default_payment_method_id?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          email?: string
          has_saved_card?: boolean
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          phone?: string | null
          reason?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          stripe_customer_id?: string | null
          stripe_default_payment_method_id?: string | null
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
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
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
          ack_at: string | null
          ack_deadline: string | null
          ack_status: string | null
          assigned_at: string | null
          booking_id: string
          created_at: string | null
          id: string
          status: string | null
          worker_id: string
        }
        Insert: {
          ack_at?: string | null
          ack_deadline?: string | null
          ack_status?: string | null
          assigned_at?: string | null
          booking_id: string
          created_at?: string | null
          id?: string
          status?: string | null
          worker_id: string
        }
        Update: {
          ack_at?: string | null
          ack_deadline?: string | null
          ack_status?: string | null
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
            foreignKeyName: "worker_bookings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_payment_status_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_bookings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_status_inconsistencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_bookings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_missing_transactions"
            referencedColumns: ["booking_id"]
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
            foreignKeyName: "worker_coverage_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_payment_status_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_coverage_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_status_inconsistencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_coverage_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_missing_transactions"
            referencedColumns: ["booking_id"]
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
      worker_coverage_overlays: {
        Row: {
          overlay_geom: unknown
          updated_at: string
          worker_id: string
          zip_count: number
        }
        Insert: {
          overlay_geom?: unknown
          updated_at?: string
          worker_id: string
          zip_count?: number
        }
        Update: {
          overlay_geom?: unknown
          updated_at?: string
          worker_id?: string
          zip_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "worker_coverage_overlays_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: true
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
          is_available: boolean
          start_time: string
          work_date: string
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          end_time: string
          id?: string
          is_available?: boolean
          start_time: string
          work_date: string
          worker_id: string
        }
        Update: {
          created_at?: string | null
          end_time?: string
          id?: string
          is_available?: boolean
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
      worker_service_areas: {
        Row: {
          area_name: string
          created_at: string
          geom: unknown
          id: string
          is_active: boolean
          polygon_coordinates: Json
          updated_at: string
          worker_id: string
        }
        Insert: {
          area_name?: string
          created_at?: string
          geom?: unknown
          id?: string
          is_active?: boolean
          polygon_coordinates: Json
          updated_at?: string
          worker_id: string
        }
        Update: {
          area_name?: string
          created_at?: string
          geom?: unknown
          id?: string
          is_active?: boolean
          polygon_coordinates?: Json
          updated_at?: string
          worker_id?: string
        }
        Relationships: []
      }
      worker_service_zipcodes: {
        Row: {
          created_at: string
          from_manual: boolean
          from_polygon: boolean
          id: string
          service_area_id: string | null
          worker_id: string
          zipcode: string
        }
        Insert: {
          created_at?: string
          from_manual?: boolean
          from_polygon?: boolean
          id?: string
          service_area_id?: string | null
          worker_id: string
          zipcode: string
        }
        Update: {
          created_at?: string
          from_manual?: boolean
          from_polygon?: boolean
          id?: string
          service_area_id?: string | null
          worker_id?: string
          zipcode?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_wsz_service_area"
            columns: ["service_area_id"]
            isOneToOne: false
            referencedRelation: "worker_service_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_wsz_worker"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      v_booking_payment_status_monitor: {
        Row: {
          booking_status: Database["public"]["Enums"]["booking_status"] | null
          consistency_status: string | null
          created_at: string | null
          id: string | null
          payment_intent_id: string | null
          payment_status: string | null
          updated_at: string | null
        }
        Insert: {
          booking_status?: Database["public"]["Enums"]["booking_status"] | null
          consistency_status?: never
          created_at?: string | null
          id?: string | null
          payment_intent_id?: string | null
          payment_status?: string | null
          updated_at?: string | null
        }
        Update: {
          booking_status?: Database["public"]["Enums"]["booking_status"] | null
          consistency_status?: never
          created_at?: string | null
          id?: string | null
          payment_intent_id?: string | null
          payment_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_booking_status_inconsistencies: {
        Row: {
          created_at: string | null
          id: string | null
          inconsistency_type: string | null
          payment_intent_id: string | null
          payment_status: string | null
          recommended_status: string | null
          status: Database["public"]["Enums"]["booking_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          inconsistency_type?: never
          payment_intent_id?: string | null
          payment_status?: string | null
          recommended_status?: never
          status?: Database["public"]["Enums"]["booking_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          inconsistency_type?: never
          payment_intent_id?: string | null
          payment_status?: string | null
          recommended_status?: never
          status?: Database["public"]["Enums"]["booking_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_invoice_payment_reconciliation: {
        Row: {
          booking_id: string | null
          booking_payment_status: string | null
          booking_status: Database["public"]["Enums"]["booking_status"] | null
          delivery_status: string | null
          email_sent: boolean | null
          invoice_amount: number | null
          invoice_id: string | null
          invoice_number: string | null
          invoice_status: string | null
          recommended_status: string | null
          total_captured: number | null
          total_refunded: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoices_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_payment_status_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_status_inconsistencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_missing_transactions"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_payment_status_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_booking_status_inconsistencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_missing_transactions"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      v_missing_transactions: {
        Row: {
          booking_id: string | null
          booking_status: Database["public"]["Enums"]["booking_status"] | null
          created_at: string | null
          customer_email: string | null
          issue: string | null
          payment_intent_id: string | null
          payment_status: string | null
        }
        Insert: {
          booking_id?: string | null
          booking_status?: Database["public"]["Enums"]["booking_status"] | null
          created_at?: string | null
          customer_email?: never
          issue?: never
          payment_intent_id?: string | null
          payment_status?: string | null
        }
        Update: {
          booking_id?: string | null
          booking_status?: Database["public"]["Enums"]["booking_status"] | null
          created_at?: string | null
          customer_email?: never
          issue?: never
          payment_intent_id?: string | null
          payment_status?: string | null
        }
        Relationships: []
      }
      v_sms_delivery_stats: {
        Row: {
          count: number | null
          date: string | null
          status: Database["public"]["Enums"]["sms_status"] | null
          success_rate: number | null
        }
        Relationships: []
      }
      worker_tips_summary: {
        Row: {
          average_tip: number | null
          last_tip_date: string | null
          max_tip: number | null
          min_tip: number | null
          total_bookings_with_tips: number | null
          total_tips_received: number | null
          worker_email: string | null
          worker_id: string | null
          worker_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      zip_coverage_summary: {
        Row: {
          active_worker_ids: string[] | null
          has_active_coverage: boolean | null
          service_area_count: number | null
          worker_count: number | null
          zipcode: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      acknowledge_assignment: {
        Args: { p_booking_id: string }
        Returns: boolean
      }
      acquire_worker_assignment_lock: {
        Args: { p_booking_id: string; p_worker_id: string }
        Returns: undefined
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      assign_worker_idempotent: {
        Args: { p_booking_id: string; p_worker_id: string }
        Returns: boolean
      }
      assign_zipcode_to_connor: { Args: { p_zipcode: string }; Returns: Json }
      auto_assign_worker_by_zip: {
        Args: { p_booking_id: string }
        Returns: boolean
      }
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
      auto_assign_workers_with_polygon_coverage: {
        Args: { p_booking_id: string }
        Returns: {
          assigned_worker_id: string
          assignment_status: string
          notifications_sent: number
        }[]
      }
      auto_assign_workers_with_strict_zip_coverage: {
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
      check_and_repair_booking_consistency: { Args: never; Returns: Json }
      check_booking_inconsistencies: {
        Args: never
        Returns: {
          booking_id: string
          current_status: string
          details: string
          issue_type: string
          recommended_action: string
        }[]
      }
      check_spatial_health: { Args: never; Returns: Json }
      check_zip_data_health: { Args: never; Returns: Json }
      cleanup_booking_inconsistencies: {
        Args: never
        Returns: {
          booking_id: string
          cleanup_type: string
          description: string
          new_status: string
          old_status: string
        }[]
      }
      cleanup_expired_idempotency_records: { Args: never; Returns: number }
      cleanup_expired_pending_bookings: {
        Args: { grace_period_minutes?: number }
        Returns: {
          created_at: string
          customer_id: string
          id: string
          stripe_payment_intent_id: string
        }[]
      }
      cleanup_orphaned_payment_records: { Args: never; Returns: number }
      clear_polygon_flag_for_area: {
        Args: { p_area_id: string }
        Returns: undefined
      }
      comprehensive_zip_has_coverage: {
        Args: { p_zipcode: string }
        Returns: boolean
      }
      compute_zipcodes_for_polygon:
        | {
            Args: { min_overlap_percent?: number; polygon_geojson: Json }
            Returns: string[]
          }
        | { Args: { p_polygon_coords: Json }; Returns: string[] }
      compute_zipcodes_for_service_area:
        | { Args: { p_service_area_id: string }; Returns: Json }
        | {
            Args: { min_overlap_percent?: number; service_area_id: string }
            Returns: string[]
          }
      create_service_area_audit_log:
        | {
            Args: {
              p_area_name?: string
              p_change_summary?: string
              p_changed_by?: string
              p_new_data?: Json
              p_old_data?: Json
              p_operation: string
              p_record_id: string
              p_table_name: string
              p_worker_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_area_name?: string
              p_new_data?: Json
              p_old_data?: Json
              p_operation: string
              p_record_id: string
              p_table_name: string
              p_worker_id?: string
            }
            Returns: string
          }
      delete_booking_with_cascade: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      determine_invoice_status: {
        Args: { p_booking_id: string }
        Returns: string
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      dropgeometrytable:
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      enablelongtransactions: { Args: never; Returns: string }
      end_impersonation_session: {
        Args: { p_session_id?: string }
        Returns: boolean
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      find_available_workers: {
        Args: {
          p_duration_minutes?: number
          p_scheduled_date: string
          p_scheduled_start: string
          p_zipcode: string
        }
        Returns: {
          distance_priority: number
          worker_email: string
          worker_id: string
          worker_name: string
          worker_phone: string
        }[]
      }
      find_available_workers_by_zip: {
        Args: {
          p_date: string
          p_duration_minutes?: number
          p_time: string
          p_zipcode: string
        }
        Returns: {
          distance_miles: number
          has_conflict: boolean
          is_available: boolean
          worker_email: string
          worker_id: string
          worker_name: string
          worker_phone: string
        }[]
      }
      find_available_workers_polygon: {
        Args: {
          booking_date: string
          booking_time: string
          customer_zipcode: string
          duration_minutes?: number
        }
        Returns: {
          distance_priority: number
          worker_id: string
        }[]
      }
      find_existing_pending_booking: {
        Args: {
          p_customer_id?: string
          p_grace_period_minutes?: number
          p_guest_email?: string
          p_guest_phone?: string
          p_scheduled_date?: string
          p_scheduled_start?: string
        }
        Returns: {
          booking_id: string
          created_at: string
          payment_intent_id: string
        }[]
      }
      find_workers_for_coverage: {
        Args: { p_booking_id: string; p_max_distance_priority?: number }
        Returns: {
          customer_zipcode: string
          distance_priority: number
          worker_email: string
          worker_id: string
          worker_name: string
          worker_phone: string
        }[]
      }
      find_zipcodes_in_polygon_geojson: {
        Args: { min_overlap_percent?: number; polygon_geojson: Json }
        Returns: {
          zipcode: string
        }[]
      }
      find_zipcodes_in_service_area: {
        Args: { p_include_boundaries?: boolean; p_polygon_coords: Json }
        Returns: {
          boundary_geojson: Json
          zipcode: string
        }[]
      }
      find_zipcodes_intersecting_polygon:
        | {
            Args: { min_overlap_percent?: number; polygon_coords: Json }
            Returns: {
              boundary_geojson: Json
              overlap_percent: number
              zipcode: string
            }[]
          }
        | {
            Args: { p_polygon: Json }
            Returns: {
              city: string
              distance_km: number
              state: string
              zipcode: string
            }[]
          }
      fix_booking_payment_status: {
        Args: { p_booking_id: string; p_payment_intent_id: string }
        Returns: Json
      }
      format_phone_e164: { Args: { phone_input: string }; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_active_impersonation: {
        Args: never
        Returns: {
          session_id: string
          started_at: string
          worker_email: string
          worker_id: string
          worker_name: string
        }[]
      }
      get_admin_dashboard_metrics: { Args: never; Returns: Json }
      get_available_time_slots: {
        Args: {
          p_date: string
          p_service_duration_minutes?: number
          p_zipcode: string
        }
        Returns: {
          available_workers: number
          time_slot: string
          worker_ids: string[]
        }[]
      }
      get_batch_zip_coordinates: {
        Args: { p_zipcodes: string[] }
        Returns: {
          city: string
          latitude: number
          longitude: number
          state_abbr: string
          zipcode: string
        }[]
      }
      get_comprehensive_batch_zip_coordinates: {
        Args: { p_zipcodes: string[] }
        Returns: {
          city: string
          latitude: number
          longitude: number
          state_abbr: string
          zipcode: string
        }[]
      }
      get_comprehensive_worker_zip_coordinates: {
        Args: { p_worker_id: string }
        Returns: {
          city: string
          latitude: number
          longitude: number
          state_abbr: string
          zipcode: string
        }[]
      }
      get_comprehensive_zcta_boundary: {
        Args: { p_zcta_code: string }
        Returns: {
          data_source: string
          geom_geojson: Json
          land_area: number
          water_area: number
          zcta5ce: string
        }[]
      }
      get_comprehensive_zip_boundaries: {
        Args: { p_lat: number; p_lng: number; p_radius_km?: number }
        Returns: {
          boundary_geojson: Json
          distance_km: number
          zipcode: string
        }[]
      }
      get_comprehensive_zip_coverage: {
        Args: { p_zipcode: string }
        Returns: {
          city: string
          data_source: string
          has_coverage: boolean
          latitude: number
          longitude: number
          state_abbr: string
          worker_count: number
          zipcode: string
        }[]
      }
      get_current_user_role: { Args: never; Returns: string }
      get_customer_stats: {
        Args: {
          limit_count?: number
          offset_count?: number
          search_term?: string
        }
        Returns: {
          city: string
          email: string
          last_booking: string
          name: string
          phone: string
          total_bookings: number
          total_count: number
          total_spent: number
          zipcode: string
        }[]
      }
      get_nearby_zip_boundaries: {
        Args: { center_lat: number; center_lng: number; radius_km?: number }
        Returns: {
          boundary_geojson: Json
          distance_km: number
          zipcode: string
        }[]
      }
      get_nearby_zip_boundaries_enhanced: {
        Args: { center_lat: number; center_lng: number; radius_km?: number }
        Returns: {
          boundary_geojson: Json
          distance_km: number
          zipcode: string
        }[]
      }
      get_secret: { Args: { secret_name: string }; Returns: string }
      get_service_area_zipcodes_with_boundaries: {
        Args: { include_boundaries?: boolean; polygon_coords: Json }
        Returns: {
          boundary_geojson: Json
          zipcode: string
        }[]
      }
      get_service_area_zipcodes_with_boundaries_enhanced:
        | {
            Args: { include_boundaries?: boolean; polygon_coords: Json }
            Returns: {
              boundary_geojson: Json
              zipcode: string
            }[]
          }
        | {
            Args: {
              include_boundaries?: boolean
              min_overlap_percent?: number
              polygon_coords: Json
            }
            Returns: {
              boundary_geojson: Json
              city: string
              overlap_percent: number
              state: string
              state_abbr: string
              zipcode: string
            }[]
          }
      get_tax_rate_by_state: {
        Args: { state_abbreviation: string }
        Returns: number
      }
      get_tip_analytics: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          avg_tip: number
          bookings_with_tips: number
          max_tip: number
          tip_percentage: number
          total_bookings: number
          total_tips: number
          worker_id: string
          worker_name: string
        }[]
      }
      get_worker_active_zipcodes: {
        Args: { p_worker_id: string }
        Returns: string[]
      }
      get_worker_count_by_zip: { Args: { p_zipcode: string }; Returns: number }
      get_worker_tip_booking_details: {
        Args: {
          p_end_date?: string
          p_start_date?: string
          p_worker_id: string
        }
        Returns: {
          booking_id: string
          booking_status: string
          created_at: string
          customer_email: string
          customer_id: string
          customer_name: string
          has_duplicate_transactions: boolean
          payment_intent_id: string
          payment_status: string
          service_date: string
          tip_amount: number
        }[]
      }
      get_worker_tips_detail: {
        Args: {
          p_end_date?: string
          p_start_date?: string
          p_worker_id: string
        }
        Returns: {
          base_amount: number
          booking_date: string
          booking_id: string
          customer_email: string
          customer_name: string
          payment_status: string
          service_name: string
          tip_amount: number
          total_amount: number
        }[]
      }
      get_worker_weekly_availability: {
        Args: { p_worker_id: string }
        Returns: Json
      }
      get_worker_zip_coordinates_batch: {
        Args: { p_worker_id: string }
        Returns: {
          city: string
          latitude: number
          longitude: number
          state_abbr: string
          zipcode: string
        }[]
      }
      get_worker_zipcode_stats: {
        Args: { p_worker_id: string }
        Returns: {
          active_areas_count: number
          total_zipcodes: number
        }[]
      }
      get_workers_for_admin: {
        Args: never
        Returns: {
          email: string
          id: string
          is_active: boolean
          name: string
          service_area_count: number
          total_zipcodes: number
        }[]
      }
      get_workers_for_zipcode: {
        Args: { p_zipcode: string }
        Returns: {
          worker_email: string
          worker_id: string
          worker_name: string
        }[]
      }
      get_zcta_boundary: {
        Args: { p_zipcode: string }
        Returns: {
          boundary_geojson: Json
          zcta5ce: string
        }[]
      }
      get_zcta_codes_for_polygon: {
        Args: { polygon_coords: Json }
        Returns: string[]
      }
      get_zip_area_info: {
        Args: { p_zipcode: string }
        Returns: {
          area_name: string
          has_active_worker: boolean
          worker_id: string
          worker_name: string
          zipcode: string
        }[]
      }
      get_zip_coverage_info: {
        Args: { p_zipcode: string }
        Returns: {
          active_workers: string[]
          has_coverage: boolean
          worker_count: number
        }[]
      }
      get_zip_service_assignment: {
        Args: { p_zip: string }
        Returns: {
          area_id: string
          area_name: string
          is_active: boolean
          worker_id: string
          worker_name: string
        }[]
      }
      get_zipcode_boundary_geojson: {
        Args: { zipcode_param: string }
        Returns: Json
      }
      get_zipcode_boundary_geojson_enhanced: {
        Args: { zipcode_param: string }
        Returns: Json
      }
      get_zipcode_location_data: {
        Args: { p_zipcode: string }
        Returns: {
          city: string
          latitude: number
          longitude: number
          state: string
          state_abbr: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      import_application_availability: {
        Args: { worker_uuid: string }
        Returns: string
      }
      import_zipcode_data_batch: {
        Args: { zipcode_data: Json }
        Returns: number
      }
      insert_zcta_batch: { Args: { batch_data: Json }; Returns: number }
      is_sms_enabled: { Args: never; Returns: boolean }
      load_sample_zipcode_data: { Args: never; Returns: Json }
      load_zcta_polygons_batch: { Args: { batch_data: Json }; Returns: Json }
      load_zcta_polygons_from_data: {
        Args: { polygon_data: Json }
        Returns: Json
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      merge_worker_service_areas: {
        Args: { p_new_area_name: string; p_worker_id: string }
        Returns: Json
      }
      migrate_existing_zip_data: { Args: never; Returns: number }
      pick_best_area_for_worker_zip: {
        Args: { p_worker: string; p_zip: string }
        Returns: string
      }
      populate_geometry_columns:
        | { Args: { use_typmod?: boolean }; Returns: string }
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
      populate_zcta_zipcodes: { Args: never; Returns: number }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      reassign_bookings_for_zipcode: {
        Args: { p_zipcode: string }
        Returns: number
      }
      rebuild_overlays_for_area_workers: {
        Args: { p_area_id: string }
        Returns: undefined
      }
      rebuild_worker_overlay: { Args: { p_worker: string }; Returns: undefined }
      recover_stuck_payment_authorized_bookings: {
        Args: never
        Returns: {
          assignment_triggered: boolean
          booking_id: string
        }[]
      }
      refresh_worker_tips_summary: { Args: never; Returns: undefined }
      refresh_zip_coverage_summary: { Args: never; Returns: undefined }
      release_expired_worker_reservations: { Args: never; Returns: number }
      repair_payment_inconsistencies: { Args: never; Returns: Json }
      resend_worker_sms: {
        Args: { booking_id_param: string }
        Returns: boolean
      }
      respond_to_coverage_request: {
        Args: { p_notification_id: string; p_response: string }
        Returns: boolean
      }
      retry_unsent_notifications: {
        Args: { p_grace_minutes?: number; p_lookback_minutes?: number }
        Returns: Json
      }
      retry_unsent_notifications_for_booking: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      retry_unsent_notifications_v2: {
        Args: { p_grace_minutes?: number; p_lookback_minutes?: number }
        Returns: Json
      }
      run_automated_watchdog:
        | { Args: never; Returns: Json }
        | {
            Args: { p_batch_limit?: number; p_lookback_minutes?: number }
            Returns: Json
          }
      select_best_available_worker: {
        Args: {
          p_date: string
          p_duration_minutes?: number
          p_preferred_worker_id?: string
          p_time: string
          p_zipcode: string
        }
        Returns: {
          availability_score: number
          selection_reason: string
          worker_email: string
          worker_id: string
          worker_name: string
          worker_phone: string
          workload_count: number
        }[]
      }
      send_email_for_booking: { Args: { p_booking_id: string }; Returns: Json }
      set_worker_weekly_availability: {
        Args: { p_availability: Json; p_worker_id: string }
        Returns: boolean
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_askml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geom: unknown }; Returns: number }
        | { Args: { geog: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      start_impersonation_session: {
        Args: { p_reason?: string; p_worker_id: string }
        Returns: string
      }
      toggle_service_area_status: {
        Args: { p_area_id: string; p_is_active: boolean }
        Returns: boolean
      }
      trigger_email_followups: { Args: never; Returns: Json }
      trigger_manual_worker_assignment: {
        Args: { p_booking_id: string }
        Returns: boolean
      }
      try_insert_worker_assignment_email_log: {
        Args: {
          p_booking_id: string
          p_message: string
          p_recipient_email: string
          p_subject: string
        }
        Returns: boolean
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      upsert_manual_zip_coverage: {
        Args: { p_add?: boolean; p_worker_id: string; p_zipcode: string }
        Returns: undefined
      }
      upsert_zip_coverage_for_area: {
        Args: { p_area_id: string }
        Returns: undefined
      }
      validate_and_clean_polygon: {
        Args: { polygon_input: Json }
        Returns: Json
      }
      validate_polygon_coverage: {
        Args: { polygon_coords: Json }
        Returns: Json
      }
      validate_polygon_coverage_enhanced: {
        Args: { polygon_coords: Json }
        Returns: {
          coverage_percentage: number
          has_coverage: boolean
          missing_zipcodes: string[]
          zipcode_count: number
        }[]
      }
      zip_has_active_coverage: { Args: { p_zipcode: string }; Returns: boolean }
      zip_has_active_coverage_by_zip: {
        Args: { p_zipcode: string }
        Returns: boolean
      }
      zipcodes_intersecting_polygon: {
        Args: { polygon_coords: Json }
        Returns: string[]
      }
      zipcodes_intersecting_polygon_geojson: {
        Args: { min_overlap_percent?: number; polygon_geojson: Json }
        Returns: {
          boundary_geojson: Json
          overlap_percent: number
          zipcode: string
        }[]
      }
    }
    Enums: {
      booking_status:
        | "pending"
        | "payment_pending"
        | "payment_authorized"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "failed"
      day_of_week:
        | "Sunday"
        | "Monday"
        | "Tuesday"
        | "Wednesday"
        | "Thursday"
        | "Friday"
        | "Saturday"
      payment_status:
        | "pending"
        | "completed"
        | "failed"
        | "authorized"
        | "captured"
        | "cancelled"
      session_status: "created" | "paid" | "expired" | "cancelled"
      sms_status: "sent" | "failed" | "pending"
      user_role: "customer" | "worker" | "admin"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
        "payment_authorized",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "failed",
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
      payment_status: [
        "pending",
        "completed",
        "failed",
        "authorized",
        "captured",
        "cancelled",
      ],
      session_status: ["created", "paid", "expired", "cancelled"],
      sms_status: ["sent", "failed", "pending"],
      user_role: ["customer", "worker", "admin"],
    },
  },
} as const
