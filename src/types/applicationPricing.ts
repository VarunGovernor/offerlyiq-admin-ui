export type PricingCurrency = "usd" | "inr" | "eur" | "gbp";

export interface PricingPackage {
  id: string;
  code: string;
  name: string;
  units: number;
  quota_type: "total" | "day" | "week" | "month";
  status: string;
}

export interface PriceValues {
  package_id: string;
  country_code: string;
  currency: PricingCurrency;
  amount_minor: number;
  starts_at: string | null;
  ends_at: string | null;
  fallback_countries: string[];
}

export interface PublishedPrice extends PriceValues {
  id: string;
  price_version_id: string;
  package_code: string;
  package_name: string;
  units: number;
  quota_type: "total" | "day" | "week" | "month";
  currency_exponent: number;
  display: string;
  version: number;
  prior_version_id: string | null;
  reason: string;
  actor_id: string;
  created_at: string;
}

export interface PriceProposal extends PriceValues {
  id: string;
  package_code: string;
  package_name: string;
  units: number;
  quota_type: "total" | "day" | "week" | "month";
  currency_exponent: number;
  display: string;
  expected_version_id: string | null;
  status: "pending" | "approved" | "rejected";
  reason: string;
  created_by: string;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  published_version_id: string | null;
  before: PublishedPrice | null;
}

export interface PriceChangeRequest extends PriceValues {
  reason: string;
  expected_version_id: string | null;
}

export interface ApplicationPricingCatalog {
  packages: PricingPackage[];
  prices: PublishedPrice[];
  proposals: PriceProposal[];
  can_publish: boolean;
}

export interface ApplicationPricingHistory {
  versions: PublishedPrice[];
  proposals: PriceProposal[];
}
