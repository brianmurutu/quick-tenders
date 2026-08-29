/**
 * Hand-written mirror of the SQL migrations, in the shape that
 * `supabase gen types typescript` produces, so that `npm run db:types` can
 * overwrite this file once you have a project linked.
 *
 * Two deliberate differences from the generator: `tenders_matched.status` and
 * `scrape_runs.status` are typed as unions rather than `string`. The generator
 * widens check constraints to `string`; if you regenerate, re-narrow both here.
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

/** Mirrors the check constraint on public.scrape_runs.status. */
export type ScrapeRunStatus = 'success' | 'partial' | 'failed'

/**
 * The notification types the pipeline emits today. Deliberately NOT a check
 * constraint in the database (see 0008), so `notifications.type` stays `string`
 * on the Row; use this where you need to switch on a known value.
 */
export type NotificationType =
  | 'tender_matched'
  | 'document_ready'
  | 'trial_ending'
  | 'trial_expired'

/** The only values public.admin_set_company_plan accepts for companies.plan. */
export type CompanyPlan = 'trial' | 'paid'

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
          paystack_customer_code: string | null
          paystack_subscription_code: string | null
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
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
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
          paystack_customer_code?: string | null
          paystack_subscription_code?: string | null
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
          phone_number: string | null
          created_at: string
        }
        Insert: {
          /** Must equal the auth.users id. There is no default. */
          id: string
          company_id?: string | null
          full_name?: string | null
          email: string
          phone_number?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          full_name?: string | null
          email?: string
          phone_number?: string | null
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
          procuring_entity: string | null
          notified_at: string | null
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
          procuring_entity?: string | null
          notified_at?: string | null
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
          procuring_entity?: string | null
          notified_at?: string | null
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
      subscriptions: {
        Row: {
          id: string
          company_id: string
          paystack_reference: string
          event_type: string
          amount_kobo: number | null
          currency: string | null
          status: string
          payload: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          paystack_reference: string
          event_type: string
          amount_kobo?: number | null
          currency?: string | null
          status?: string
          payload?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          paystack_reference?: string
          event_type?: string
          amount_kobo?: number | null
          currency?: string | null
          status?: string
          payload?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      // Internal Quick Tenders staff (0008). A separate account type from
      // representatives, not a role on it. Readable only by an admin, and
      // writable only with the service role: there is no policy or grant that
      // lets an admin mint another admin.
      admin_users: {
        Row: {
          id: string
          full_name: string | null
          email: string
          created_at: string
        }
        Insert: {
          /** Must equal the auth.users id. There is no default. */
          id: string
          full_name?: string | null
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string
          created_at?: string
        }
        // id -> auth.users(id) is omitted for the same reason as on
        // representatives: auth.users is outside the public schema.
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          representative_id: string | null
          /** See NotificationType for the values the pipeline emits. */
          type: string | null
          title: string | null
          body: string | null
          link_url: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          representative_id?: string | null
          type?: string | null
          title?: string | null
          body?: string | null
          link_url?: string | null
          is_read?: boolean
          created_at?: string
        }
        // A representative holds UPDATE on is_read and nothing else (0008), so
        // only that key is reachable from a user session. The rest are writable
        // with the service role.
        Update: {
          id?: string
          representative_id?: string | null
          type?: string | null
          title?: string | null
          body?: string | null
          link_url?: string | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_representative_id_fkey'
            columns: ['representative_id']
            isOneToOne: false
            referencedRelation: 'representatives'
            referencedColumns: ['id']
          },
        ]
      }
      // Discovery pipeline health (0008). Readable by admins only, written by
      // the discovery job with the service role.
      scrape_runs: {
        Row: {
          id: string
          source: string | null
          run_at: string
          tenders_fetched: number | null
          status: ScrapeRunStatus
          error_message: string | null
        }
        Insert: {
          id?: string
          source?: string | null
          run_at?: string
          tenders_fetched?: number | null
          status: ScrapeRunStatus
          error_message?: string | null
        }
        Update: {
          id?: string
          source?: string | null
          run_at?: string
          tenders_fetched?: number | null
          status?: ScrapeRunStatus
          error_message?: string | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      /**
       * Admin only, enforced inside the function. Pushes trial_ends_at out by
       * p_days (1-365) from today or the current end, whichever is later, and
       * returns the new value. Exists because 0004 leaves trial_ends_at
       * ungranted to every client role — see 0008.
       */
      admin_extend_trial: {
        Args: { p_company_id: string; p_days: number }
        Returns: string
      }
      /** Admin only, enforced inside the function. Returns the plan it set. */
      admin_set_company_plan: {
        Args: { p_company_id: string; p_plan: CompanyPlan }
        Returns: string
      }
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
      /**
       * True when the caller is Quick Tenders internal staff. Referenced by the
       * admin RLS policies in 0008; callable directly to decide whether to
       * render an admin surface, but never as the only gate — the policies are.
       */
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      normalise_email_domain: {
        Args: { p_email: string }
        Returns: string | null
      }
      /** Service role only. Reads across every tenant. */
      pending_tender_drafts: {
        Args: { p_limit?: number }
        Returns: {
          tender_id: string
          title: string | null
          source_url: string | null
          deadline: string | null
          summary: string | null
          match_score: number | null
          procuring_entity: string | null
          notified_at: string | null
          document_count: number
          company_id: string
          company_name: string | null
          industry: string | null
          sectors_of_interest: string[] | null
          region: string | null
          company_size: string | null
          representative_name: string | null
          representative_emails: string[] | null
          representative_phones: string[] | null
        }[]
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
