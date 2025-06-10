
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
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          base_price: number
          duration_minutes: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          base_price?: number
          duration_minutes?: number
          is_active?: boolean
          created_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_booking_total: {
        Args: {
          service_ids: string[]
          quantities: number[]
        }
        Returns: {
          total_price: number
          total_duration: number
        }
      }
      calculate_cancellation_fee: {
        Args: {
          booking_id: string
        }
        Returns: number
      }
      find_available_workers: {
        Args: {
          job_date: string
          job_time: string
          job_duration: number
          job_region: string
        }
        Returns: {
          worker_id: string
        }[]
      }
    }
    Enums: {
      user_role: 'customer' | 'worker' | 'admin'
      booking_status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
      payment_status: 'pending' | 'success' | 'failed' | 'refunded'
      sms_status: 'sent' | 'delivered' | 'failed'
    }
  }
}
