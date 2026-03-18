// Este archivo se genera automáticamente con:
// npm run db:types
//
// Por ahora es un placeholder para que TypeScript no rompa.
// Correr el comando tras conectar Supabase.

export type Database = {
  public: {
    Tables: {
      destinations: {
        Row: {
          id: string
          code: string
          name: string
          country: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['destinations']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['destinations']['Insert']>
      }
      hotels: {
        Row: {
          id: string
          destination_id: string
          name: string
          description: string | null
          category: 'Inn/Apart' | 'Inn' | 'Comfort' | 'Superior' | 'Luxury'
          priority: number
          currency: string
          distance_center: string | null
          closing_date: string | null
          season_open: string | null
          is_family: boolean
          family_type: string | null
          is_direct: boolean
          platform_name: string | null
          tourplan_code: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          net_rate_validity: string | null
          pc_rate_validity: string | null
          rate_requested_at: string | null
          active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['hotels']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['hotels']['Insert']>
      }
      rates: {
        Row: {
          id: string
          hotel_id: string
          season: '24-25' | '26-27'
          room_base: 'SGL' | 'DBL' | 'TPL'
          pc_rate: number | null
          net_rate: number | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['rates']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['rates']['Insert']>
      }
      promotions: {
        Row: {
          id: string
          hotel_id: string
          title: string
          description: string | null
          promo_type: 'early_booking' | 'free_night' | 'discount' | 'other'
          discount_pct: number | null
          free_nights: number | null
          valid_from: string | null
          valid_until: string | null
          book_by: string | null
          conditions: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['promotions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['promotions']['Insert']>
      }
      availability_requests: {
        Row: {
          id: string
          hotel_id: string
          operator_id: string | null
          operator_email: string
          operator_name: string | null
          check_in: string
          check_out: string
          pax_count: number
          room_base: 'SGL' | 'DBL' | 'TPL'
          room_count: number
          notes: string | null
          status: 'pending' | 'confirmed' | 'unavailable' | 'expired'
          confirm_token: string
          decline_token: string
          hotel_email_sent_at: string | null
          responded_at: string | null
          operator_notified_at: string | null
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['availability_requests']['Row'], 'id' | 'confirm_token' | 'decline_token' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['availability_requests']['Insert']>
      }
    }
  }
}
