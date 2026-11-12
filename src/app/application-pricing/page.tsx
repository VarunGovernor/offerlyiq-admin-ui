"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw, Plus, ArrowLeft, Loader2 } from "lucide-react";
import { admin } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { getApiErrorDetail, getApiErrorStatus } from "@/lib/utils";
import { parseFallbackCountries, parsePriceAmount } from "@/lib/application-pricing";
import { useAdminSession } from "@/components/layout/admin-session-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ApplicationPricingCatalog, ApplicationPricingHistory, PriceChangeRequest, PriceProposal, PriceValues, PricingCurrency, PublishedPrice } from "@/types/applicationPricing";

type FormState = {
  packageId: string;
  country: string;
  currency: PricingCurrency;
  amount: string;
  reason: string;
  start: string;
  end: string;
  fallbacks: string;
  before: PublishedPrice | null;
};

const inputClass = "w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const currencyOptions: PricingCurrency[] = ["usd", "inr", "eur", "gbp"];
const token = () => getAccessToken() || undefined;
const timestamp = (value: string | null) => value ? new Date(value).toLocaleString() : "None";
const amountLabel = (value: PriceValues) => `${new Intl.NumberFormat(undefined, { style: "currency", currency: value.currency }).format(value.amount_minor / 100)} (${value.currency.toUpperCase()})`;
const localDate = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function PriceSummary({ value, title }: { value: (PriceValues & { package_name?: string; units?: number; quota_type?: string }) | null; title: string }) {
  return <div className="min-w-0 rounded-lg border border-border p-4">
    <h3 className="text-sm font-semibold mb-2">{title}</h3>
    {value ? <dl className="text-sm space-y-2">
      {value.package_name && <div><dt className="text-muted-foreground">Package</dt><dd>{value.package_name}{value.units !== undefined && ` (${value.units} / ${value.quota_type})`}</dd></div>}
      <div><dt className="text-muted-foreground">Price</dt><dd className="font-semibold">{amountLabel(value)}</dd></div>
      <div><dt className="text-muted-foreground">Market</dt><dd>{value.country_code}</dd></div>
      <div><dt className="text-muted-foreground">Allowance window</dt><dd>{value.starts_at ? `${timestamp(value.starts_at)} to ${timestamp(value.ends_at)}` : "No fixed window"}</dd></div>
      <div><dt className="text-muted-foreground">Explicit fallback countries</dt><dd className="break-words">{value.fallback_countries.join(", ") || "None"}</dd></div>
    </dl> : <p className="text-sm text-muted-foreground">No published price for this market.</p>}
  </div>;
}

function ErrorNote({ error }: { error: unknown }) {
  const status = getApiErrorStatus(error);
  return <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-300">
    {status === 403 ? "You do not have permission for this action. " : status === 409 ? "This price or request has changed. Refresh and review it before trying again. " : ""}
    {getApiErrorDetail(error) || (error instanceof Error ? error.message : "Unable to complete the request.")}
  </div>;
}

export default function ApplicationPricingPage() {
  const { user } = useAdminSession();
  const [catalog, setCatalog] = useState<ApplicationPricingCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"prices" | "requests" | "history">("prices");
  const [filter, setFilter] = useState("all");
  const [history, setHistory] = useState<ApplicationPricingHistory | null>(null);
  const [historyError, setHistoryError] = useState<unknown>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [mode, setMode] = useState<"proposal" | "publish">("proposal");
  const [preview, setPreview] = useState<PriceChangeRequest | null>(null);
  const [review, setReview] = useState<PriceProposal | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const actionHeading = useRef<HTMLHeadingElement>(null);
  const canPublish = user?.role === "superadmin" && catalog?.can_publish === true;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setCatalog(await admin.getApplicationPricing(token())); }
    catch (err) { setError(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const actionKey = form ? `form-${mode}` : review?.id || null;
  useEffect(() => { if (actionKey) actionHeading.current?.focus(); }, [actionKey]);

  const loadHistory = async () => {
    setHistoryLoading(true); setHistoryError(null);
    try { setHistory(await admin.getApplicationPricingHistory(token())); }
    catch (err) { setHistoryError(err); }
    finally { setHistoryLoading(false); }
  };

  const openForm = (price: PublishedPrice | null = null, direct = false) => {
    setReview(null); setPreview(null); setActionError(null); setNotice("");
    setMode(direct ? "publish" : "proposal");
    setForm({ packageId: price?.package_id || catalog?.packages[0]?.id || "", country: price?.country_code || "", currency: price?.currency || "usd", amount: price ? (price.amount_minor / 100).toFixed(2) : "", reason: "", start: localDate(price?.starts_at || null), end: localDate(price?.ends_at || null), fallbacks: price?.fallback_countries.join(", ") || "", before: price });
  };

  const selectMarket = (packageId: string, country: string) => {
    if (!form) return;
    const normalized = country.trim().toUpperCase();
    const before = catalog?.prices.find((p) => p.package_id === packageId && p.country_code === normalized) || null;
    setForm({ ...form, packageId, country, before }); setPreview(null);
  };

  const prepare = (event: React.FormEvent) => {
    event.preventDefault(); setActionError(null);
    if (!form) return;
    try {
      const pkg = catalog?.packages.find((p) => p.id === form.packageId);
      if (!pkg) throw new Error("Choose a configured package.");
      const country = form.country.trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(country)) throw new Error("Enter a two-letter country code.");
      const reason = form.reason.trim();
      if (!reason) throw new Error("A reason is required.");
      let starts_at: string | null = null; let ends_at: string | null = null;
      if (pkg.quota_type !== "total") {
        if (!form.start || !form.end) throw new Error("Set both allowance window dates.");
        starts_at = new Date(form.start).toISOString(); ends_at = new Date(form.end).toISOString();
        if (starts_at >= ends_at) throw new Error("The window end must be after its start.");
      }
      setPreview({ package_id: form.packageId, country_code: country, currency: form.currency, amount_minor: parsePriceAmount(form.amount), reason, expected_version_id: form.before?.id || null, starts_at, ends_at, fallback_countries: parseFallbackCountries(form.fallbacks, country) });
    } catch (err) { setActionError(err); }
  };

  const submit = async () => {
    if (!preview || busy || (mode === "publish" && !canPublish)) return;
    setBusy(true); setActionError(null);
    try {
      if (mode === "publish") await admin.publishApplicationPrice(preview, token());
      else await admin.proposeApplicationPrice(preview, token());
      setNotice(mode === "publish" ? "New price version published. Checkout settings are unchanged." : "Proposal submitted. Published pricing is unchanged until approval.");
      setForm(null); setPreview(null); setHistory(null); await load();
    } catch (err) { setActionError(err); }
    finally { setBusy(false); }
  };

  const decide = async (action: "approve" | "reject") => {
    if (!review || busy || !canPublish) return;
    if (!reviewReason.trim()) { setActionError(new Error("A review reason is required.")); return; }
    setBusy(true); setActionError(null);
    try {
      await admin.reviewApplicationPrice(review.id, action, reviewReason.trim(), token());
      setNotice(action === "approve" ? "Proposal approved and price version published. Checkout settings are unchanged." : "Proposal rejected. Published pricing is unchanged.");
      setReview(null); setReviewReason(""); setHistory(null); await load();
    } catch (err) { setActionError(err); }
    finally { setBusy(false); }
  };

  const currentReviewPrice = review ? catalog?.prices.find((p) => p.package_id === review.package_id && p.country_code === review.country_code) || null : null;
  const staleReview = Boolean(review && (currentReviewPrice?.id || null) !== review.expected_version_id);
  const selectedPackage = catalog?.packages.find((p) => p.id === form?.packageId);
  const requests = (catalog?.proposals || []).filter((p) => filter === "all" || p.status === filter);

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
      <div><Link href="/application-packages" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"><ArrowLeft className="h-4 w-4" /> Application packages</Link><h1 className="text-3xl font-bold tracking-tight">Application pricing</h1><p className="text-muted-foreground mt-1">Regional prices, approval requests and published versions.</p></div>
      <Button variant="outline" onClick={() => { void load(); if (tab === "history") void loadHistory(); }} disabled={loading || busy} className="gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh prices</Button>
    </div>
    <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">Publishing a price does not enable checkout or change existing purchases. Application packages are separate from AI-credit plans.</p>
    {notice && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">{notice}</p>}
    {Boolean(error) && <ErrorNote error={error} />}
    {loading && !catalog && <p role="status" className="flex gap-2 items-center"><Loader2 className="h-4 w-4 animate-spin" />Loading pricing...</p>}
    {catalog && <>
      <div className="flex flex-wrap gap-2" aria-label="Pricing views">
        <Button variant="outline" className={tab === "prices" ? "bg-muted text-foreground border-primary" : ""} aria-pressed={tab === "prices"} onClick={() => setTab("prices")}>Published prices</Button>
        <Button variant="outline" className={tab === "requests" ? "bg-muted text-foreground border-primary" : ""} aria-pressed={tab === "requests"} onClick={() => setTab("requests")}>Requests ({catalog.proposals.filter((p) => p.status === "pending").length} pending)</Button>
        {canPublish && <Button variant="outline" className={tab === "history" ? "bg-muted text-foreground border-primary" : ""} aria-pressed={tab === "history"} onClick={() => { setTab("history"); void loadHistory(); }}>Audit history</Button>}
      </div>
      {tab === "prices" && <Card><CardHeader><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div><CardTitle>Published regional prices</CardTitle><CardDescription>{canPublish ? "Publish directly or review an administrator's request." : "Request a change for Super Admin approval."}</CardDescription></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => openForm()} disabled={!catalog.packages.length || busy} className="gap-1"><Plus className="h-4 w-4" />Propose a price</Button>{canPublish && <Button onClick={() => openForm(null, true)} disabled={!catalog.packages.length || busy} className="text-zinc-950">Set price directly</Button>}</div></div></CardHeader><CardContent>
        {!catalog.prices.length ? <p className="py-6 text-muted-foreground">No published prices. Choose a package and market to start.</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{catalog.prices.map((price) => <article key={price.id} className="min-w-0 rounded-lg border border-border p-4 space-y-3"><div className="flex justify-between gap-2"><h3 className="font-semibold">{price.package_name} · {price.country_code}</h3><Badge variant="outline">v{price.version}</Badge></div><p className="text-xl font-semibold">{price.display} <span className="text-sm font-normal">{price.currency.toUpperCase()}</span></p><p className="text-xs text-muted-foreground break-words">Fallbacks: {price.fallback_countries.join(", ") || "None"}</p><p className="text-xs text-muted-foreground">Published {timestamp(price.created_at)}</p><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => openForm(price)} disabled={busy}>Propose change<span className="sr-only"> for {price.package_name} {price.country_code}</span></Button>{canPublish && <Button variant="outline" size="sm" onClick={() => openForm(price, true)} disabled={busy}>Edit price<span className="sr-only"> for {price.package_name} {price.country_code}</span></Button>}</div></article>)}</div>}
      </CardContent></Card>}
      {tab === "requests" && <Card><CardHeader><CardTitle>Price change requests</CardTitle><div className="max-w-xs space-y-1"><label htmlFor="request-filter" className="text-sm">Status</label><select id="request-filter" className={inputClass} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All requests</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div></CardHeader><CardContent className="space-y-3">{!requests.length ? <p className="text-muted-foreground py-6">No requests in this view.</p> : requests.map((proposal) => <article key={proposal.id} className="rounded-lg border border-border p-4 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start"><div className="min-w-0 space-y-1"><h3 className="font-semibold">{proposal.package_name} · {proposal.country_code}</h3><p className="text-sm">{proposal.before ? amountLabel(proposal.before) : "Not published"} → {amountLabel(proposal)}</p><p className="text-sm break-words">{proposal.reason}</p><p className="text-xs text-muted-foreground">Requested {timestamp(proposal.created_at)}</p></div><div className="flex flex-wrap gap-2 items-center"><Badge variant="outline">{proposal.status}</Badge><Button variant="outline" size="sm" disabled={busy} onClick={() => { setForm(null); setPreview(null); setReview(proposal); setReviewReason(""); setActionError(null); }}>{canPublish && proposal.status === "pending" ? "Review request" : "View request"}<span className="sr-only"> for {proposal.package_name} {proposal.country_code}</span></Button></div></article>)}</CardContent></Card>}
      {tab === "history" && canPublish && <Card><CardHeader><CardTitle>Pricing audit history</CardTitle><CardDescription>Published versions and recorded decisions cannot be edited here.</CardDescription></CardHeader><CardContent className="space-y-4">{historyLoading && <p role="status">Loading history...</p>}{Boolean(historyError) && <ErrorNote error={historyError} />}{history && <><h3 className="font-semibold">Published versions</h3>{!history.versions.length && <p className="text-muted-foreground">No published versions.</p>}{history.versions.map((price) => <article key={price.id} className="rounded-lg border border-border p-4 space-y-2 min-w-0"><h4 className="font-semibold">{price.package_name} · {price.country_code} · v{price.version}</h4><PriceSummary value={price} title="Published values" /><p className="text-sm break-words">{price.reason}</p><p className="text-xs text-muted-foreground break-all">Published by {price.actor_id} at {timestamp(price.created_at)}<br />Version {price.id}</p></article>)}<h3 className="font-semibold">Request decisions</h3>{!history.proposals.length && <p className="text-muted-foreground">No requests recorded.</p>}{history.proposals.map((proposal) => <article key={proposal.id} className="rounded-lg border border-border p-4 space-y-2"><h4 className="font-semibold">{proposal.package_name} · {proposal.country_code} · {proposal.status}</h4><p className="text-sm break-words">{proposal.reason}</p><p className="text-sm break-words">{proposal.review_reason || "Awaiting review"}</p><p className="text-xs text-muted-foreground break-all">Requested by {proposal.created_by} at {timestamp(proposal.created_at)}{proposal.reviewed_by && <><br />Reviewed by {proposal.reviewed_by} at {timestamp(proposal.reviewed_at)}</>}</p></article>)}</>}</CardContent></Card>}
      {form && <Card><CardHeader><h2 ref={actionHeading} tabIndex={-1} className="text-xl font-semibold focus:outline-none">{mode === "publish" ? "Publish a price version" : "Propose a price change"}</h2><CardDescription>{mode === "publish" ? "Review all values before publishing. A reason is required." : "The current price stays active until a Super Admin approves this request."}</CardDescription></CardHeader><CardContent className="space-y-4">{Boolean(actionError) && <ErrorNote error={actionError} />}
        {!preview ? <form onSubmit={prepare} className="space-y-4"><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2"><div className="space-y-1"><label htmlFor="pricing-package" className="text-sm font-medium">Package</label><select id="pricing-package" className={inputClass} value={form.packageId} required onChange={(e) => selectMarket(e.target.value, form.country)}>{catalog.packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name} ({pkg.units} / {pkg.quota_type})</option>)}</select></div><div className="space-y-1"><label htmlFor="pricing-country" className="text-sm font-medium">Country / market code</label><input id="pricing-country" value={form.country} onChange={(e) => selectMarket(form.packageId, e.target.value.toUpperCase())} className={inputClass} required maxLength={2} placeholder="US" autoComplete="off" aria-describedby="pricing-country-help" /><p id="pricing-country-help" className="text-xs text-muted-foreground">Two-letter country code, such as US, IN, GB or DE.</p></div><div className="space-y-1"><label htmlFor="pricing-currency" className="text-sm font-medium">Currency</label><select id="pricing-currency" className={inputClass} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as PricingCurrency })}>{currencyOptions.map((currency) => <option key={currency} value={currency}>{currency.toUpperCase()}</option>)}</select></div><div className="space-y-1"><label htmlFor="pricing-amount" className="text-sm font-medium">Proposed price ({form.currency.toUpperCase()})</label><input id="pricing-amount" className={inputClass} inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required maxLength={12} aria-describedby="pricing-amount-help" /><p id="pricing-amount-help" className="text-xs text-muted-foreground">Enter the full currency amount, with up to two decimal places.</p></div>{selectedPackage?.quota_type !== "total" && <><div className="space-y-1"><label htmlFor="pricing-start" className="text-sm font-medium">Allowance start (local time)</label><input id="pricing-start" type="datetime-local" className={inputClass} value={form.start} required onChange={(e) => setForm({ ...form, start: e.target.value })} /></div><div className="space-y-1"><label htmlFor="pricing-end" className="text-sm font-medium">Allowance end (local time)</label><input id="pricing-end" type="datetime-local" className={inputClass} value={form.end} required onChange={(e) => setForm({ ...form, end: e.target.value })} /></div></>}<div className="space-y-1 sm:col-span-2"><label htmlFor="pricing-fallbacks" className="text-sm font-medium">Explicit fallback countries (optional)</label><input id="pricing-fallbacks" className={inputClass} value={form.fallbacks} onChange={(e) => setForm({ ...form, fallbacks: e.target.value })} placeholder="FR, ES" aria-describedby="pricing-fallback-help" /><p id="pricing-fallback-help" className="text-xs text-muted-foreground">Comma-separated country codes using the same currency. No automatic global fallback.</p></div><div className="space-y-1 sm:col-span-2"><label htmlFor="pricing-reason" className="text-sm font-medium">Reason</label><textarea id="pricing-reason" className={inputClass} rows={3} maxLength={1000} required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div></fieldset><PriceSummary value={form.before} title="Current published values" /><div className="flex flex-wrap gap-2"><Button type="submit" className="text-zinc-950" disabled={busy}>Review change</Button><Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button></div></form> : <div className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><PriceSummary value={form.before} title="Before" /><PriceSummary value={{ ...preview, package_name: selectedPackage?.name, units: selectedPackage?.units, quota_type: selectedPackage?.quota_type }} title="Proposed" /></div><p className="text-sm break-words"><strong>Reason:</strong> {preview.reason}</p><p className="text-xs text-muted-foreground">{form.before ? `Based on published version ${form.before.version}.` : "This creates the first price for this market."} A newer publication will require a fresh review.</p><div className="flex flex-wrap gap-2"><Button onClick={() => void submit()} disabled={busy || (mode === "publish" && !canPublish)} className="text-zinc-950">{busy ? "Saving..." : mode === "publish" ? "Publish price" : "Submit proposal"}</Button><Button variant="outline" onClick={() => { setPreview(null); setActionError(null); }} disabled={busy}>Edit change</Button><Button variant="outline" onClick={() => { setForm(null); setPreview(null); }} disabled={busy}>Cancel</Button></div></div>}
      </CardContent></Card>}
      {review && <Card><CardHeader><h2 ref={actionHeading} tabIndex={-1} className="text-xl font-semibold focus:outline-none">{canPublish && review.status === "pending" ? "Review price request" : "Price request details"}</h2><CardDescription>{review.package_name} · {review.country_code} · {review.status}</CardDescription></CardHeader><CardContent className="space-y-4">{Boolean(actionError) && <ErrorNote error={actionError} />}<div className="grid gap-4 md:grid-cols-2"><PriceSummary value={review.before} title="Before the request" /><PriceSummary value={review} title="Requested values" /></div><p className="text-sm break-words"><strong>Reason:</strong> {review.reason}</p><p className="text-xs text-muted-foreground break-all">Requested by {review.created_by} at {timestamp(review.created_at)}</p>{review.reviewed_by && <p className="text-sm break-words">Reviewed by {review.reviewed_by} at {timestamp(review.reviewed_at)}: {review.review_reason}</p>}{review.status === "pending" && staleReview && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">The published price has changed since this proposal. It cannot be approved. Reject it and request a new proposal based on the current version.</p>}{canPublish && review.status === "pending" && <><div className="space-y-1"><label htmlFor="review-reason" className="text-sm font-medium">Review reason</label><textarea id="review-reason" className={inputClass} rows={3} maxLength={1000} required value={reviewReason} disabled={busy} onChange={(e) => setReviewReason(e.target.value)} /></div><div className="flex flex-wrap gap-2"><Button className="text-zinc-950" onClick={() => void decide("approve")} disabled={busy || staleReview}>Approve and publish</Button><Button variant="outline" onClick={() => void decide("reject")} disabled={busy}>Reject request</Button></div></>}<Button variant="outline" disabled={busy} onClick={() => setReview(null)}>Close request</Button></CardContent></Card>}
    </>}
  </div>;
}
