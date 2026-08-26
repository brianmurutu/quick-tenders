/**
 * Hand-written mirror of supabase/migrations/0001_init.sql, in the shape
 * `supabase gen types typescript` produces — so `npm run db:types` can
 * overwrite this file once you have a project linked.
 *
 * One deliberate difference from the generator: `tenders_matched.status` is
 * typed as the TenderStatus union rather than `string`. The generator widens
 * check constraints to `string`; if you regenerate, re-narrow it here.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/** Mirrors the check constraint on public.tenders_matched.status. */
export type TenderStatus = 'new' | 'reviewed' | 'submitted' | 'expired'

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string | null
          domain: string
          industry: string | null
          sectors_of_interest: string[] | null
          region: string | null
          company_size: string | null
          trial_started_at: string
          trial_ends_at: string
          plan: string
          created_at: string
        }
        Insert: {
          id?: string
          name?: string | null
          domain: string
          industry?: string | null
          sectors_of_interest?: string[] | null
          region?: string | null
          company_size?: string | null
          trial_started_at?: string
          /** Defaults to trial_started_at + 3 days via trigger. */
          trial_ends_at?: string
          plan?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          domain?: string
          industry?: string | null
          sectors_of_interest?: string[] | null
          region?: string | null
          company_size?: string | null
          trial_started_at?: string
          trial_ends_at?: string
          plan?: string
          created_at?: string
        }
        Relationships: []
      }
      representatives: {
        Row: {
          id: string
          company_id: string | null
          full_name: string | null
          email: string
          created_at: string
        }
        Insert: {
          /** Must equal the auth.users id — there is no default. */
          id: string
          company_id?: string | null
          full_name?: string | null
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          full_name?: string | null
          email?: string
          created_at?: string
        }
        // The id -> auth.users(id) foreign key is omitted: auth.users is not
        // part of the public schema, so it cannot be traversed in a select.
        Relationships: [
          {
            foreignKeyName: 'representatives_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      tenders_matched: {
        Row: {
          id: string
          company_id: string | null
          title: string | null
          source_url: string | null
          deadline: string | null
          summary: string | null
          match_score: number | null
          status: TenderStatus
          created_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          title?: string | null
          source_url?: string | null
          deadline?: string | null
          summary?: string | null
          match_score?: number | null
          status?: TenderStatus
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          title?: string | null
          source_url?: string | null
          deadline?: string | null
          summary?: string | null
          match_score?: number | null
          status?: TenderStatus
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tenders_matched_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      tender_documents: {
        Row: {
          id: string
          tender_id: string | null
          doc_type: string | null
          storage_path: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tender_id?: string | null
          doc_type?: string | null
          storage_path?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tender_id?: string | null
          doc_type?: string | null
          storage_path?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tender_documents_tender_id_fkey'
            columns: ['tender_id']
            isOneToOne: false
            referencedRelation: 'tenders_matched'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      current_company_id: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
      tender_belongs_to_current_company: {
        Args: { p_tender_id: string }
        Returns: boolean
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
