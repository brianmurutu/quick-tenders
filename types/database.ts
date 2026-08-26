/**
 * Hand-written mirror of the SQL migrations, in the shape that
 * `supabase gen types typescript` produces, so that `npm run db:types` can
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

/** Values of the `status` key returned by public.company_signup_status(). */
export type SignupStatus =
  | 'available'
  | 'join_existing'
  | 'representative_exists'
  | 'not_company_domain'
  | 'invalid'

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
          /** Must equal the auth.users id. There is no default. */
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
      // RLS is enabled with no policies and no grants, so no client can read
      // this. Present for completeness; reached only through the SECURITY
      // DEFINER helpers in 0002.
      blocked_email_domains: {
        Row: {
          domain: string
          created_at: string
        }
        Insert: {
          domain: string
          created_at?: string
        }
        Update: {
          domain?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      company_signup_status: {
        Args: { p_domain: string }
        /**
         * jsonb. Shape depends on `status`; parse it with parseSignupStatus in
         * lib/signup.ts rather than trusting the keys.
         */
        Returns: Json
      }
      complete_onboarding: {
        Args: Record<PropertyKey, never>
        /** The company id the caller is now attached to. */
        Returns: string
      }
      current_company_id: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
      normalise_email_domain: {
        Args: { p_email: string }
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
