"use client";

import { useState } from "react";
import { admin } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { getApiErrorDetail } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PaymentOperations } from "@/types/paymentOperations";

type Execution = { id: string; status: string; provider_id: string | null; amount_minor: number; currency: string; evidence?: string };

export function isExecution(value: unknown): value is Execution {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<Execution>;
  return typeof record.id === "string" && !!record.id && typeof record.status === "string" && !!record.status && typeof record.currency === "string" && !!record.currency && Number.isSafeInteger(record.amount_minor) && (record.amount_minor ?? -1) >= 0;
}

export function executionMessage(status: string) {
  if (status === "succeeded") return "Refund confirmed by the provider.";
  if (status === "failed" || status === "canceled") return "Refund did not complete. Review provider evidence before any further action.";
  if (status === "requires_action") return "Provider action is required. No successful refund is confirmed yet. Review provider evidence and reconcile status.";
  if (status === "pending" || status === "processing") return "Refund is pending. No successful refund is confirmed yet.";
  return "Refund outcome requires reconciliation. Do not create another refund.";
}

export function canExecuteRefund(state: PaymentOperations | null) {
  return !!state && state.environment !== "production" && state.can_modify && state.refund_execution_available && state.switches.refunds.effective;
}

export default function RefundExecution({ requestId }: { requestId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Execution | null>(null);
  const [state, setState] = useState<PaymentOperations | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [basis, setBasis] = useState("");
  const [checked, setChecked] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [providerId, setProviderId] = useState("");
  const valid = reason.trim().length >= 3 && /^\d+$/.test(basis) && Number.isSafeInteger(Number(basis)) && Number(basis) > 0;
  const check = async () => {
    if (busy) return;
    setBusy(true); setError(""); setChecked(false);
    try {
      const token = getAccessToken() || undefined;
      const operations = await admin.getPaymentOperations(token);
      setState(operations);
      const execution = await admin.getApplicationRefundExecution(requestId, token);
      if (execution !== null && !isExecution(execution)) throw new Error("Incomplete execution status");
      setResult(execution); setChecked(true);
      if (execution?.id) setUncertain(false);
    } catch (e) { setError(getApiErrorDetail(e) || "Unable to verify refund execution state. Check status before continuing."); }
    finally { setBusy(false); }
  };
  const execute = async () => {
    if (!canExecuteRefund(state) || !checked || uncertain || result || busy || !valid) return;
    setBusy(true); setError("");
    try {
      const execution = await admin.executeApplicationRefund(requestId, reason.trim(), Number(basis), getAccessToken() || undefined);
      if (!isExecution(execution)) throw new Error("Missing execution evidence");
      setResult(execution); setOpen(false);
    } catch (e) {
      setUncertain(true); setChecked(false); setOpen(false);
      setError(`${getApiErrorDetail(e) || "Execution response unavailable."} No successful refund is confirmed. Check status; do not submit another refund.`);
    } finally { setBusy(false); }
  };
  const reconcile = async () => {
    if (!state?.can_modify || !state.refund_execution_available || state.environment === "production" || busy || (providerId.trim().length > 128 || (providerId.trim() && !/^re_[A-Za-z0-9_]+$/.test(providerId.trim())))) return;
    setBusy(true); setError("");
    try {
      const execution = await admin.reconcileApplicationRefund(requestId, providerId.trim() || undefined, getAccessToken() || undefined);
      if (!isExecution(execution)) throw new Error("Missing reconciliation evidence");
      setResult(execution); setUncertain(false);
    } catch (e) { setError(getApiErrorDetail(e) || "Provider status remains unverified. No new refund was requested."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 border-t pt-3">
    <Button variant="outline" disabled={busy} onClick={() => void check()}>{busy ? "Checking..." : "Check refund execution"}</Button>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    {result && <div role="status" className="space-y-1 text-sm"><p className="font-medium">{executionMessage(result.status)}</p><p>Provider refund status: {result.status}</p><p>Refund amount: {result.amount_minor} minor units ({result.currency.toUpperCase()})</p>{result.provider_id && <p className="break-all">Provider reference: {result.provider_id}</p>}</div>}
    {state && <p className="text-sm">Environment: {state.environment}. Production refund execution is unavailable.</p>}
    {checked && !canExecuteRefund(state) && <p className="text-sm text-muted-foreground">Test refund execution is unavailable. Super Admin access, a non-production environment, an available endpoint and the effective refund switch are all required. {state?.switches.refunds.blockers.join(" ")}</p>}
    {uncertain && <p className="text-sm">Reconciliation required. Status checks do not create a new refund.</p>}
    {state?.can_modify && state.refund_execution_available && state.environment !== "production" && (uncertain || (result && ["pending", "processing", "requires_action", "reconciliation_required"].includes(result.status))) && <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm">Retrieve trusted provider status without creating another refund. Use the stored provider reference, or enter an exact reference from provider evidence. Never guess a reference.</p>
      <label className="block space-y-1"><span>Provider refund reference (optional)</span><input maxLength={128} value={providerId} onChange={event => setProviderId(event.target.value)} disabled={busy} placeholder="re_..." className="w-full rounded-md border bg-background p-3" /></label>
      <Button variant="outline" disabled={busy || providerId.trim().length > 128 || (!!providerId.trim() && !/^re_[A-Za-z0-9_]+$/.test(providerId.trim()))} onClick={() => void reconcile()}>Reconcile provider status</Button>
    </div>}
    {checked && canExecuteRefund(state) && !result && !uncertain && <Button onClick={() => setOpen(true)}>Execute test refund</Button>}
    {open && <div role="dialog" aria-modal="true" aria-label="Confirm test refund" onKeyDown={event => {
      if (event.key === "Escape" && !busy) setOpen(false);
      if (event.key === "Tab") {
        const elements = event.currentTarget.querySelectorAll<HTMLElement>("input:not(:disabled), textarea:not(:disabled), button:not(:disabled)");
        const first = elements[0]; const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border bg-background p-6 shadow-xl">
      <h3 className="text-lg font-semibold">Confirm test refund</h3>
      <p className="text-sm">Environment: {state?.environment}. This is a separate action from approving the review. No production refund is permitted.</p>
      <p className="text-sm text-muted-foreground">Enter the verified refundable charge basis in minor currency units, not a proposed refund amount. The server validates payment evidence and calculates eligible unused usage. Ambiguous tax, discount, usage and rounding remain in review.</p>
      <label className="block space-y-1"><span>Verified refundable basis (minor units)</span><input autoFocus inputMode="numeric" value={basis} onChange={event => setBasis(event.target.value)} disabled={busy} className="w-full rounded-md border bg-background p-3" /></label>
      <label className="block space-y-1"><span>Execution reason</span><textarea value={reason} maxLength={1000} onChange={event => setReason(event.target.value)} disabled={busy} className="w-full rounded-md border bg-background p-3" /></label>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !valid} onClick={() => void execute()}>{busy ? "Submitting..." : "Confirm test refund"}</Button><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button></div>
    </div></div>}
  </div>;
}
