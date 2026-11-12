/**
 * Read-only response contracts for the draft application-package commerce surface.
 *
 * These mirror the backend's app/schemas/application_packages.py one-to-one.
 * Application packages are an independent catalog: never coupled to AI-credit
 * plans, wallets or ledgers. Admin responses intentionally carry no price data
 * while pricing approval is pending - `DraftPackageConfiguration` keeps every
 * approval-pending value null and publishing disabled. Do not invent values
 * client-side, and never use these types for the AI credit-plan surface
 * (see billings.ts and /plans).
 */

export type PackageStatus = "draft" | "active" | "retired";
export type PackageCode = "starter" | "daily" | "weekly" | "monthly";
export type QuotaType = "total" | "day" | "week" | "month";
export type ReservationStatus = "reserved" | "outcome_unknown" | "consumed" | "released";
export type EntitlementStatus =
  | "active"
  | "cancelled"
  | "expired"
  | "refund_review"
  | "dispute_review"
  | "pending";
export type PurchaseStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refund_review"
  | "dispute_review";

/** Approval-pending contract, not a writable price or publishing command. */
export interface DraftPackageConfiguration {
  amount_minor: null;
  currency: null;
  billing_interval: null;
  billing_interval_count: null;
  publication_status: "draft";
  checkout_enabled: false;
}

export interface AdminPackageItem {
  id: string;
  code: PackageCode;
  name: string;
  units: number;
  quota_type: QuotaType;
  status: PackageStatus;
  prices: null;
  draft_configuration: DraftPackageConfiguration;
  created_at: string;
}

export interface AdminPackageCatalog {
  packages: AdminPackageItem[];
}

/** Immutable usage audit rows for one candidate. Chronological; ≤200 rows. */
export interface AdminUsageEventItem {
  reservation_id: string;
  application_key: string;
  status: ReservationStatus;
  evidence: string;
  created_at: string;
}

export interface AdminUsageHistory {
  events: AdminUsageEventItem[];
}

export interface AdminPurchaseRow {
  purchase_id: string;
  package_code: string | null;
  units: number;
  quota_type: QuotaType;
  amount_minor: number;
  currency: string;
  currency_exponent?: number;
  status: PurchaseStatus;
  starts_at: string | null;
  ends_at: string | null;
}

export interface AdminPaymentStatus {
  purchases: AdminPurchaseRow[];
}

/** One purchased period for a candidate (allocation portion of the report). */
export interface ApplicationAllocation {
  id: string;
  entitlement_status: EntitlementStatus;
  period_key: string;
  starts_at: string | null;
  ends_at: string | null;
  units: number;
  held: number;
  consumed: number;
  /** units − held − consumed. NOT spendable unless the entitlement is usable. */
  remaining: number;
}

export interface UserAllowanceReport {
  allocations: ApplicationAllocation[];
  /** Authoritative backend verdict - do not derive spendability client-side. */
  can_reserve: boolean;
  payment_status: string;
}
