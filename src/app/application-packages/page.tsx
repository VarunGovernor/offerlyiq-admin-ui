"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { admin } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  Loader2,
  RefreshCw,
  Search,
  PackageOpen,
  Users,
  Activity,
  ReceiptText,
  Info,
  Lock,
  Clock,
  Ban,
  AlertTriangle,
} from "lucide-react";
import { useAdminSession } from "@/components/layout/admin-session-provider";
import { getApiErrorDetail, getApiErrorStatus } from "@/lib/utils";
import type {
  AdminPackageItem,
  AdminPurchaseRow,
  AdminUsageEventItem,
  ApplicationAllocation,
  EntitlementStatus,
  PurchaseStatus,
  QuotaType,
  ReservationStatus,
  UserAllowanceReport,
} from "@/types/applicationPackages";

/* ------------------------------------------------------------------ */
/* Formatting helpers (derived from the data; nothing is invented)     */
/* ------------------------------------------------------------------ */

function formatAmount(minor: number, currency: string, exponent?: number): string {
  const code = currency.toUpperCase();
  // Older purchase responses omit the exponent; TWD used zero decimals in that contract.
  const digits = exponent ?? (code === "TWD" ? 0 : new Intl.NumberFormat(undefined, {
    style: "currency", currency: code,
  }).resolvedOptions().maximumFractionDigits ?? 2);
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${formatter.format(minor / 10 ** digits)} (${code})`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------------ */
/* Status chips (presentation only - the API value stays authoritative) */
/* ------------------------------------------------------------------ */

function Chip({
  status,
  tone,
  label,
}: {
  status: string;
  tone: "ok" | "warn" | "bad" | "muted" | "info";
  label?: string;
}) {
  const toneClass = {
    ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    warn: "bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/30",
    bad: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
    muted: "bg-muted text-zinc-600 dark:text-muted-foreground border-border",
    info: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  }[tone];
  return (
    <Badge variant="outline" className={`border font-medium ${toneClass}`}>
      {label ?? status}
    </Badge>
  );
}

function packageStatusTone(status: AdminPackageItem["status"]) {
  if (status === "active") return "ok" as const;
  if (status === "retired") return "muted" as const;
  return "info" as const; // draft
}

function entitlementTone(status: EntitlementStatus) {
  if (status === "active") return "ok" as const;
  if (status === "expired" || status === "cancelled") return "bad" as const;
  if (status === "pending") return "warn" as const;
  return "warn" as const; // refund_review / dispute_review
}

function purchaseTone(status: PurchaseStatus) {
  if (status === "paid") return "ok" as const;
  if (status === "pending") return "warn" as const;
  if (status === "failed" || status === "cancelled") return "bad" as const;
  return "warn" as const; // refund_review / dispute_review
}

function usageTone(status: ReservationStatus) {
  if (status === "consumed") return "ok" as const;
  if (status === "outcome_unknown") return "warn" as const;
  if (status === "released") return "muted" as const;
  return "info" as const; // reserved
}

/** Why the remaining count may not be spendable right now. `null` when fine. */
function allocationHoldNote(a: ApplicationAllocation): string | null {
  switch (a.entitlement_status) {
    case "active":
      return null;
    case "refund_review":
      return "Under refund review - this is a pending review, not a completed refund.";
    case "dispute_review":
      return "Under dispute review - pending; the entitlement stays unavailable while disputed.";
    case "pending":
      return "Entitlement pending - remaining units are not spendable yet.";
    case "expired":
      return "Entitlement expired - remaining units in this window are not spendable.";
    case "cancelled":
      return "Entitlement cancelled - remaining units are not spendable.";
  }
}

const QUOTA_HINT: Record<QuotaType, string> = {
  total: "total uses across the window",
  day: "uses per day",
  week: "uses per week",
  month: "uses per month",
};

/* ------------------------------------------------------------------ */
/* Load/error state cards                                              */
/* ------------------------------------------------------------------ */

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center p-12 text-muted-foreground bg-card rounded-xl border border-border shadow-sm">
      <Loader2 className="w-8 h-8 animate-spin mb-4" />
      <p>{label}</p>
    </div>
  );
}

/**
 * Distinguishes the four contract states of this surface: 401 (no/invalid
 * token), 403 (signed in but not admin), 404 (APPLICATION_COMMERCE_ENABLED=
 * false hides the routes), anything else (transport/5xx).
 */
function AccessStateCard({ err, onRetry }: { err: unknown; onRetry: () => void }) {
  const status = getApiErrorStatus(err);
  const detail = getApiErrorDetail(err);

  if (status === 401) {
    return (
      <div className="col-span-full p-8 bg-card rounded-xl border border-border text-center">
        <Lock className="w-10 h-10 mx-auto mb-4 text-muted-foreground/60" />
        <h3 className="text-lg font-medium mb-1">Sign in required</h3>
        <p className="text-muted-foreground mb-4">
          Your admin session is missing or expired. Sign in again to view application packages.
        </p>
        <Link href="/login">
          <Button variant="outline">Go to sign in</Button>
        </Link>
      </div>
    );
  }

  if (status === 403) {
    return (
      <div className="col-span-full p-8 bg-card rounded-xl border border-border text-center">
        <Ban className="w-10 h-10 mx-auto mb-4 text-red-700 dark:text-red-400/70" />
        <h3 className="text-lg font-medium mb-1">Admin access required</h3>
        <p className="text-muted-foreground">
          This account is not an admin. The application-package surface is restricted to admin
          and superadmin accounts.
        </p>
      </div>
    );
  }

  if (status === 404) {
    return (
      <div className="col-span-full p-8 bg-card rounded-xl border border-border text-center">
        <Info className="w-10 h-10 mx-auto mb-4 text-primary/70" />
        <h3 className="text-lg font-medium mb-1">Application commerce is not enabled</h3>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Application packages are unavailable in this environment. Contact the service
          owner if you expected access.
        </p>
      </div>
    );
  }

  return (
    <div className="col-span-full p-8 bg-card rounded-xl border border-border text-center">
      <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-amber-800 dark:text-amber-400/80" />
      <h3 className="text-lg font-medium mb-1">Could not load application packages</h3>
      <p className="text-muted-foreground mb-4">{detail || "An unexpected error occurred."}</p>
      <Button variant="outline" className="gap-2" onClick={onRetry}>
        <RefreshCw className="w-4 h-4" /> Retry
      </Button>
    </div>
  );
}

function SectionErrorNote({ err }: { err: unknown }) {
  const status = getApiErrorStatus(err);
  const detail = getApiErrorDetail(err);
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400 text-sm">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="leading-relaxed">
        <span className="font-medium">
          {status === 401
            ? "Session expired - sign in again."
            : status === 403
              ? "Admin access required."
              : status === 404
                ? "Application commerce is not enabled on this backend."
                : "Request failed."}
        </span>{" "}
        <span>{detail}</span>
      </div>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm border border-dashed border-border rounded-lg bg-muted/10 text-center px-6">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ApplicationPackagesPage() {
  const { user: sessionUser } = useAdminSession();

  // Catalog
  const [packages, setPackages] = useState<AdminPackageItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<unknown>(null);

  // Customer lookup
  const [customerId, setCustomerId] = useState("");
  const [customerIdError, setCustomerIdError] = useState<string | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerLoaded, setCustomerLoaded] = useState(false);
  const [allowance, setAllowance] = useState<UserAllowanceReport | null>(null);
  const [allowanceError, setAllowanceError] = useState<unknown>(null);
  const [usageEvents, setUsageEvents] = useState<AdminUsageEventItem[] | null>(null);
  const [usageError, setUsageError] = useState<unknown>(null);
  const [purchases, setPurchases] = useState<AdminPurchaseRow[] | null>(null);
  const [paymentsError, setPaymentsError] = useState<unknown>(null);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const { getAccessToken } = await import("@/lib/auth");
      const token = getAccessToken() || undefined;
      const response = await admin.getApplicationPackages(token);
      setPackages(response?.packages ?? []);
    } catch (err) {
      console.error("Failed to fetch application packages", err);
      setCatalogError(err);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const loadCustomer = useCallback(async () => {
    const id = customerId.trim();
    if (!UUID_PATTERN.test(id)) {
      setCustomerIdError("Enter the customer's user ID as a UUID (e.g. from the Users section).");
      return;
    }
    setCustomerIdError(null);
    setCustomerLoading(true);
    setCustomerLoaded(false);
    setAllowance(null);
    setAllowanceError(null);
    setUsageEvents(null);
    setUsageError(null);
    setPurchases(null);
    setPaymentsError(null);

    try {
      const { getAccessToken } = await import("@/lib/auth");
      const token = getAccessToken() || undefined;
      const [report, usage, payments] = await Promise.allSettled([
        admin.getApplicationPackageUserReport(id, token),
        admin.getApplicationPackageUserUsage(id, token),
        admin.getApplicationPackageUserPayments(id, token),
      ]);
      if (report.status === "fulfilled") setAllowance(report.value);
      else setAllowanceError(report.reason);
      if (usage.status === "fulfilled") setUsageEvents(usage.value.events ?? []);
      else setUsageError(usage.reason);
      if (payments.status === "fulfilled") setPurchases(payments.value.purchases ?? []);
      else setPaymentsError(payments.reason);
    } finally {
      setCustomerLoading(false);
      setCustomerLoaded(true);
    }
  }, [customerId]);

  /* Column defs for the two audit tables */

  const usageColumns: Column<AdminUsageEventItem>[] = [
    {
      key: "when",
      header: "When",
      render: (e) => (
        <span title={e.created_at}>{formatDateTime(e.created_at)}</span>
      ),
    },
    {
      key: "application",
      header: "Application",
      render: (e) => (
        <code className="text-xs bg-muted/40 px-1.5 py-0.5 rounded">{e.application_key}</code>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (e) => <Chip status={e.status} tone={usageTone(e.status)} />,
    },
    {
      key: "reservation",
      header: "Reservation",
      render: (e) => (
        <span
          className="font-mono text-xs text-muted-foreground"
          title={e.reservation_id}
        >
          {e.reservation_id.slice(0, 8)}…
        </span>
      ),
    },
    {
      key: "evidence",
      header: "Evidence",
      render: (e) => (
        <span
          title={e.evidence}
          className="inline-block max-w-[260px] truncate align-bottom text-muted-foreground"
        >
          {e.evidence}
        </span>
      ),
    },
  ];

  const purchaseColumns: Column<AdminPurchaseRow>[] = [
    {
      key: "package",
      header: "Package",
      render: (p) => p.package_code ?? "-",
    },
    {
      key: "units",
      header: "Units",
      render: (p) => (
        <span title={QUOTA_HINT[p.quota_type]}>
          {p.units}{" "}
          <span className="text-muted-foreground text-xs">/ {p.quota_type}</span>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (p) => formatAmount(p.amount_minor, p.currency, p.currency_exponent),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <Chip status={p.status} tone={purchaseTone(p.status)} />,
    },
    {
      key: "period",
      header: "Window",
      render: (p) => (
        <span className="text-muted-foreground text-xs">
          {formatDateTime(p.starts_at)} – {formatDateTime(p.ends_at)}
        </span>
      ),
    },
  ];

  const pendingReviews =
    purchases?.filter(
      (p) => p.status === "refund_review" || p.status === "dispute_review",
    ) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Application Packages</h1>
          <p className="text-muted-foreground">
            Application allowances, usage and payment records.
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={loadCatalog}
          disabled={catalogLoading}
        >
          <RefreshCw className={`w-4 h-4 ${catalogLoading ? "animate-spin" : ""}`} />
          Refresh catalog
        </Button>
      </div>

      {/* Contract banner: this surface's boundaries. */}
      <div className="flex items-start gap-2 p-3 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 text-primary mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-foreground">Read-only monitoring.</strong> Manage regional prices and approval requests in the{" "}
          <Link href="/application-pricing" className="underline hover:text-foreground">pricing workspace</Link>.{" "}
          Price publication does not enable checkout. AI
          credit plans (
          <Link href="/plans" className="underline hover:text-foreground">
            /plans
          </Link>
          ) are a completely separate system; nothing here touches credits wallets.
        </div>
      </div>

      {/* Catalog */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageOpen className="w-5 h-5 text-primary" /> Package catalog
          </CardTitle>
          <CardDescription>
            What the backend would sell, in its canonical display order. Amounts publish only
            after prices are approved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {catalogLoading ? (
              <LoadingCard label="Loading catalog..." />
            ) : catalogError ? (
              <AccessStateCard err={catalogError} onRetry={loadCatalog} />
            ) : packages.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center p-12 text-muted-foreground bg-card rounded-xl border border-border border-dashed">
                <PackageOpen className="w-12 h-12 mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium text-foreground mb-1">
                  No packages configured yet
                </h3>
                <p>
                  The backend catalog is empty. Packages appear here only when the backend
                  provisions them - nothing is created from this admin surface.
                </p>
              </div>
            ) : (
              packages.map((pkg) => {
                const cfg = pkg.draft_configuration;
                return (
                  <Card key={pkg.id} className="flex flex-col border-border/70">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{pkg.name}</CardTitle>
                        <Badge
                          variant="outline"
                          className="border bg-muted text-zinc-600 dark:text-muted-foreground font-mono text-xs uppercase"
                          title={`package code: ${pkg.code}`}
                        >
                          {pkg.code}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-2 text-xs">
                        <span title={QUOTA_HINT[pkg.quota_type]}>{pkg.units} uses</span>
                        <span>·</span>
                        <span className="capitalize">{pkg.quota_type}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip
                          status={pkg.status}
                          tone={packageStatusTone(pkg.status)}
                        />
                      </div>

                      {/* Draft configuration - the approval-pending contract itself. */}
                      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount</span>
                          <span className="font-medium">
                            {cfg.amount_minor === null
                              ? "pending approval"
                              : `${cfg.amount_minor} minor units`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Currency</span>
                          <span className="font-medium">{cfg.currency ?? "-"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Billing cadence</span>
                          <span className="font-medium">
                            {cfg.billing_interval ?? "-"}
                            {cfg.billing_interval_count !== null
                              ? ` ×${cfg.billing_interval_count}`
                              : ""}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Publication</span>
                          <span className="font-medium">{cfg.publication_status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Checkout</span>
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${
                              cfg.checkout_enabled ? "text-amber-800 dark:text-amber-400" : "text-muted-foreground"
                            }`}
                          >
                            <Lock className="w-3 h-3" />
                            {cfg.checkout_enabled ? "unlocked" : "disabled"}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground mt-auto">
                        Created {formatDateTime(pkg.created_at)}
                      </p>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Customer lookup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Customer look-up
          </CardTitle>
          <CardDescription>
            Enter a customer&apos;s user ID to read their purchased application allowances,
            usage history and payment records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col sm:flex-row gap-2 sm:items-start"
            onSubmit={(e) => {
              e.preventDefault();
              loadCustomer();
            }}
          >
            <div className="flex-1">
              <label htmlFor="application-customer-id" className="sr-only">Customer user ID</label>
              <input
                id="application-customer-id"
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="User ID (UUID)"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                spellCheck={false}
                aria-invalid={Boolean(customerIdError)}
                aria-describedby={customerIdError ? "application-customer-id-error" : undefined}
              />
              {customerIdError && (
                <p id="application-customer-id-error" role="alert" className="text-xs text-red-700 dark:text-red-400 mt-1">{customerIdError}</p>
              )}
            </div>
            <Button type="submit" className="gap-2 text-zinc-950" disabled={customerLoading}>
              {customerLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Load customer
            </Button>
          </form>
          {sessionUser && (
            <p className="text-xs text-muted-foreground">
              Signed in as {sessionUser.email}
              {sessionUser.role ? ` (${sessionUser.role})` : ""} - 403 responses here mean the
              backing account lacks admin rights.
            </p>
          )}

          {customerLoading && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <p className="text-sm">Reading allocations, usage and payments...</p>
            </div>
          )}

          {!customerLoading && customerLoaded && (
            <div className="space-y-6">
              {/* Allowance report */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" /> Allowances
                </h3>
                {allowanceError ? (
                  <SectionErrorNote err={allowanceError} />
                ) : allowance && allowance.allocations.length > 0 ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Reservable now:</span>
                      <Chip
                        status={allowance.can_reserve ? "reservable" : "not reservable"}
                        tone={allowance.can_reserve ? "ok" : "warn"}
                      />
                      <span>
                        · remaining counts uses minus held minus consumed, but is{" "}
                        <strong className="text-foreground">not spendable</strong> unless the
                        entitlement is active and the window is open - always trust this badge
                        over the raw count.
                      </span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {allowance.allocations.map((a) => {
                        const hold = allocationHoldNote(a);
                        return (
                          <div
                            key={a.id}
                            className="rounded-lg border border-border bg-background/40 p-4 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div
                                  className="font-mono text-xs text-muted-foreground"
                                  title={a.id}
                                >
                                  allocation {a.id.slice(0, 8)}…
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {a.starts_at && a.ends_at
                                    ? `${formatDateTime(a.starts_at)} – ${formatDateTime(a.ends_at)}`
                                    : "no window (open allocation)"}
                                </div>
                              </div>
                              <Chip
                                status={a.entitlement_status}
                                tone={entitlementTone(a.entitlement_status)}
                              />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                              {[
                                { label: "units", value: a.units },
                                { label: "held", value: a.held },
                                { label: "consumed", value: a.consumed },
                                { label: "remaining", value: a.remaining },
                              ].map((m) => (
                                <div
                                  key={m.label}
                                  className="rounded-md border border-border/60 bg-muted/20 py-2"
                                >
                                  <div className="text-lg font-semibold">{m.value}</div>
                                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    {m.label}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              period_key: <code>{a.period_key}</code>
                            </div>
                            {hold && (
                              <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-400 text-xs">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>{hold}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <EmptyNote>
                    <Users className="w-8 h-8 mb-2 text-muted-foreground/50" />
                    No purchased application allocations for this user - the empty state stays
                    empty.
                  </EmptyNote>
                )}
              </div>

              {/* Usage history */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-muted-foreground" /> Application usage
                </h3>
                {usageError ? (
                  <SectionErrorNote err={usageError} />
                ) : usageEvents && usageEvents.length > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Oldest first {usageEvents.length >= 200 ? "(first 200 of a longer trail)" : ""}.
                      Rows are an immutable audit trail; nothing here can be edited.
                    </p>
                    <DataTable
                      columns={usageColumns}
                      data={usageEvents}
                      keyExtractor={(e) => `${e.reservation_id}-${e.status}-${e.created_at}`}
                      pageSize={10}
                    />
                  </>
                ) : (
                  <EmptyNote>
                    <Activity className="w-8 h-8 mb-2 text-muted-foreground/50" />
                    No application usage recorded for this user yet.
                  </EmptyNote>
                )}
              </div>

              {/* Payment status */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ReceiptText className="w-4 h-4 text-muted-foreground" /> Payment status
                </h3>
                {paymentsError ? (
                  <SectionErrorNote err={paymentsError} />
                ) : purchases && purchases.length > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Payment rows shown as recorded (max 200). Reported payment_status:{" "}
                      <code>{allowance?.payment_status ?? "-"}</code>
                    </p>
                    <DataTable
                      columns={purchaseColumns}
                      data={purchases}
                      keyExtractor={(p) => p.purchase_id}
                      pageSize={10}
                    />
                    {pendingReviews.length > 0 && (
                      <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-400 text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="leading-relaxed">
                          {pendingReviews.length} purchase
                          {pendingReviews.length === 1 ? " is" : "s are"} under refund or
                          dispute review. These are <strong>pending reviews, not completed
                          refunds</strong> - the entitlement stays unavailable until a
                          commercial decision resolves the review.
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyNote>
                    <ReceiptText className="w-8 h-8 mb-2 text-muted-foreground/50" />
                    No application-package payments for this user. Rows appear here only after
                    real payment activity.
                  </EmptyNote>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
