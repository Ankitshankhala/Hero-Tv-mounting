
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
      users: {
        Row: {
          id: string
          email: string
          name: string
          phone: string | null
          city: string | null
          region: string | null
          role: 'customer' | 'worker' | 'admin'
          is_active: boolean
          created_at: string
          updated_at: string
          zipcode: string | null
          longitude: number | null
          latitude: number | null
        }
        Insert: {
          id?: string
          email: string
          name: string
          phone?: string | null
          city?: string | null
          region?: string | null
          role?: 'customer' | 'worker' | 'admin'
          is_active?: boolean
          created_at?: string
          updated_at?: string
          zipcode?: string | null
          longitude?: number | null
          latitude?: number | null
        }
        Update: {
          id?: string
          email?: string
          name?: string
          phone?: string | null
          city?: string | null
          region?: string | null
          role?: 'customer' | 'worker' | 'admin'
          is_active?: boolean
          created_at?: string
          updated_at?: string
          zipcode?: string | null
          longitude?: number | null
          latitude?: number | null
        }
      }
      services: {
        Row: {
          id: string
          name: string
          description: string | null
          base_price: number
          duration_minutes: number
          is_active: boolean
          created_at: string
          image_url: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          base_price: number
          duration_minutes: number
          is_active?: boolean
          created_at?: string
          image_url?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          base_price?: number
          duration_minutes?: number
          is_active?: boolean
          created_at?: string
          image_url?: string | null
        }
      }
      worker_availability: {
        Row: {
          id: string
          worker_id: string
          day_of_week: number
          start_time: string
          end_time: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          worker_id: string
          day_of_week: number
          start_time: string
          end_time: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          worker_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          is_active?: boolean
          created_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          customer_id: string
          worker_id: string | null
          scheduled_at: string
          services: Json
          total_price: number
          total_duration_minutes: number
          status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
          cancellation_fee: number
          customer_address: string
          special_instructions: string | null
          created_at: string
          updated_at: string
          has_modifications: boolean
          pending_payment_amount: number | null
          google_calendar_event_id: string | null
          is_calendar_synced: boolean
        }
        Insert: {
          id?: string
          customer_id: string
          worker_id?: string | null
          scheduled_at: string
          services: Json
          total_price: number
          total_duration_minutes: number
          status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
          cancellation_fee?: number
          customer_address: string
          special_instructions?: string | null
          created_at?: string
          updated_at?: string
          has_modifications?: boolean
          pending_payment_amount?: number | null
          google_calendar_event_id?: string | null
          is_calendar_synced?: boolean
        }
        Update: {
          id?: string
          customer_id?: string
          worker_id?: string | null
          scheduled_at?: string
          services?: Json
          total_price?: number
          total_duration_minutes?: number
          status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
          cancellation_fee?: number
          customer_address?: string
          special_instructions?: string | null
          created_at?: string
          updated_at?: string
          has_modifications?: boolean
          pending_payment_amount?: number | null
          google_calendar_event_id?: string | null
          is_calendar_synced?: boolean
        }
      }
      transactions: {
        Row: {
          id: string
          booking_id: string
          stripe_payment_id: string | null
          amount: number
          status: 'pending' | 'success' | 'failed' | 'refunded'
          payment_method: string | null
          processed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          stripe_payment_id?: string | null
          amount: number
          status?: 'pending' | 'success' | 'failed' | 'refunded'
          payment_method?: string | null
          processed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          stripe_payment_id?: string | null
          amount?: number
          status?: 'pending' | 'success' | 'failed' | 'refunded'
          payment_method?: string | null
          processed_at?: string | null
          created_at?: string
        }
      }
      sms_logs: {
        Row: {
          id: string
          booking_id: string
          recipient_phone: string
          message_body: string
          twilio_sid: string | null
          status: 'sent' | 'delivered' | 'failed'
          sent_at: string
          delivered_at: string | null
          error_message: string | null
        }
        Insert: {
          id?: string
          booking_id: string
          recipient_phone: string
          message_body: string
          twilio_sid?: string | null
          status?: 'sent' | 'delivered' | 'failed'
          sent_at?: string
          delivered_at?: string | null
          error_message?: string | null
        }
        Update: {
          id?: string
          booking_id?: string
          recipient_phone?: string
          message_body?: string
          twilio_sid?: string | null
          status?: 'sent' | 'delivered' | 'failed'
          sent_at?: string
          delivered_at?: string | null
          error_message?: string | null
        }
      }
      reviews: {
        Row: {
          id: string
          booking_id: string
          customer_id: string
          worker_id: string | null
          rating: number
          comment: string | null
          image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          customer_id: string
          worker_id?: string | null
          rating: number
          comment?: string | null
          image_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          customer_id?: string
          worker_id?: string | null
          rating?: number
          comment?: string | null
          image_url?: string | null
          created_at?: string
        }
      }
      invoice_modifications: {
        Row: {
          id: string
          booking_id: string
          worker_id: string
          original_services: Json
          modified_services: Json
          original_total: number
          modified_total: number
          modification_reason: string | null
          customer_approved: boolean
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          worker_id: string
          original_services: Json
          modified_services: Json
          original_total: number
          modified_total: number
          modification_reason?: string | null
          customer_approved?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          worker_id?: string
          original_services?: Json
          modified_services?: Json
          original_total?: number
          modified_total?: number
          modification_reason?: string | null
          customer_approved?: boolean
          created_at?: string
        }
      }
      on_site_charges: {
        Row: {
          id: string
          booking_id: string
          worker_id: string
          service_name: string
          description: string | null
          amount: number
          status: string
          stripe_payment_id: string | null
          charged_at: string
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          worker_id: string
          service_name: string
          description?: string | null
          amount: number
          status?: string
          stripe_payment_id?: string | null
          charged_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          worker_id?: string
          service_name?: string
          description?: string | null
          amount?: number
          status?: string
          stripe_payment_id?: string | null
          charged_at?: string
          created_at?: string
        }
      }
      payment_sessions: {
        Row: {
          id: string
          booking_id: string
          amount: number
          currency: string
          status: string
          stripe_session_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          amount: number
          currency?: string
          status?: string
          stripe_session_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          amount?: number
          currency?: string
          status?: string
          stripe_session_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      worker_schedules: {
        Row: {
          id: string
          worker_id: string
          date: string
          start_time: string
          end_time: string
          is_available: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          worker_id: string
          date: string
          start_time: string
          end_time: string
          is_available?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          worker_id?: string
          date?: string
          start_time?: string
          end_time?: string
          is_available?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      worker_applications: {
        Row: {
          id: string
          name: string
          email: string
          phone: string
          city: string
          region: string
          experience: string
          skills: string | null
          has_tools: boolean
          has_vehicle: boolean
          availability: Json
          background_check_consent: boolean
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone: string
          city: string
          region: string
          experience: string
          skills?: string | null
          has_tools?: boolean
          has_vehicle?: boolean
          availability: Json
          background_check_consent?: boolean
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string
          city?: string
          region?: string
          experience?: string
          skills?: string | null
          has_tools?: boolean
          has_vehicle?: boolean
          availability?: Json
          background_check_consent?: boolean
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'customer' | 'worker' | 'admin'
      booking_status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
      payment_status: 'pending' | 'success' | 'failed' | 'refunded'
      sms_status: 'sent' | 'delivered' | 'failed'
    }
  }
}
