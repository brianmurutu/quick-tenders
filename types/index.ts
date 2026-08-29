/**
 * Convenience aliases over the generated `Database` type. Import from here
 * (`@/types`) in application code so a regenerated database.ts stays a
 * drop-in replacement.
 */

import type { Database, TenderStatus } from './database'

export type {
  CompanyPlan,
  Database,
  Json,
  NotificationType,
  ScrapeRunStatus,
  SignupStatus,
  TenderStatus,
} from './database'

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']

export type Company = Tables<'companies'>
export type CompanyInsert = TablesInsert<'companies'>
export type CompanyUpdate = TablesUpdate<'companies'>

export type Representative = Tables<'representatives'>
export type RepresentativeInsert = TablesInsert<'representatives'>
export type RepresentativeUpdate = TablesUpdate<'representatives'>

export type MatchedTender = Tables<'tenders_matched'>
export type MatchedTenderInsert = TablesInsert<'tenders_matched'>
export type MatchedTenderUpdate = TablesUpdate<'tenders_matched'>

export type TenderDocument = Tables<'tender_documents'>
export type TenderDocumentInsert = TablesInsert<'tender_documents'>
export type TenderDocumentUpdate = TablesUpdate<'tender_documents'>

/** Internal Quick Tenders staff. Not a representative; see migration 0008. */
export type AdminUser = Tables<'admin_users'>
export type AdminUserInsert = TablesInsert<'admin_users'>

export type Notification = Tables<'notifications'>
export type NotificationInsert = TablesInsert<'notifications'>
export type NotificationUpdate = TablesUpdate<'notifications'>

export type ScrapeRun = Tables<'scrape_runs'>
export type ScrapeRunInsert = TablesInsert<'scrape_runs'>

/** Runtime counterpart to TenderStatus, for selects, filters and validation. */
export const TENDER_STATUSES = [
  'new',
  'reviewed',
  'submitted',
  'expired',
] as const satisfies readonly TenderStatus[]
