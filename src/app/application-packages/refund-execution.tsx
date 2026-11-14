"use client";

import { useState } from "react";
import { admin } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { getApiErrorDetail } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Execution = { id: string; status: string; provider_id: string | null; amount_minor: number; currency: string; evidence?: string };

export default function RefundExecution({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [basis, setBasis] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Execution | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [environment, setEnvironment] = useState("");
  const [checked, setChecked] = useState(false);
  const check = async () => {
    setBusy(true); setError(""); setAllowed(false); setChecked(false);
    try {
      const state = await admin.getPaymentOperations(getAccessToken() || undefined);
      setAllowed(state.can_modify && state.switches.refunds.effective);
      setEnvironment(state.environment); setChecked(true);
      if (!state.switches.refunds.effective) setError(state.switches.refunds.blockers.join(" ") || "Refund execution is OFF. Reviews remain available.");
      const execution = await admin.getApplicationRefundExecution(requestId, getAccessToken() || undefined);
      if (execution?.id) setResult(execution);
    } catch (e) { setAllowed(false); setError(getApiErrorDetail(e) || "Unable to verify refund execution state. Refresh before retrying."); }
    finally { setBusy(false); }
  };
  const execute = async () => {
    if (!allowed || busy || !reason.trim() || !/^\d+$/.test(basis) || !Number.isSafeInteger(Number(basis)) || Number(basis) <= 0) return;
    setBusy(true); setError("");
    try {
      const data = await admin.executeApplicationRefund(requestId, reason.trim(), Number(basis), getAccessToken() || undefined);
      setResult(data); setOpen(false);
    } catch (e) { setAllowed(false); setOpen(false); setChecked(false); setError(getApiErrorDetail(e) || "Outcome uncertain. Check provider status before retrying this request."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 border-t pt-3">
    <Button variant="outline" disabled={busy} onClick={() => void check()}>{busy ? "Checking..." : "Check refund execution"}</Button>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    {result && <div role="status" className="space-y-1 text-sm"><p>Provider refund status: {result.status}</p><p>Refund amount: {result.amount_minor} minor units ({result.currency.toUpperCase()})</p>{result.provider_id && <p className="break-all">Provider reference: {result.provider_id}</p>}</div>}
    {checked && allowed && !result && !open && <Button onClick={() => setOpen(true)}>Execute authorized refund</Button>}
    {open && <div role="dialog" aria-modal="true" aria-label="Confirm refund execution" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md space-y-4 rounded-xl border bg-background p-6 shadow-xl">
      <h3 className="text-lg font-semibold">Confirm refund execution</h3><p>Environment: {environment}. This is separate from approving the review.</p>
      <p className="text-sm text-muted-foreground">Confirm the verified refundable charge basis in minor currency units. The server validates the payment evidence and calculates eligible unused usage. Ambiguous tax, discount, usage or rounding remains in review.</p>
      <label className="block space-y-1"><span>Verified refundable basis (minor units)</span><input autoFocus inputMode="numeric" value={basis} onChange={event => setBasis(event.target.value)} disabled={busy} className="w-full rounded-md border bg-background p-3" /></label>
      <label className="block space-y-1"><span>Execution reason</span><textarea value={reason} maxLength={1000} onChange={event => setReason(event.target.value)} disabled={busy} className="w-full rounded-md border bg-background p-3" /></label>
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !reason.trim() || !/^\d+$/.test(basis) || Number(basis) <= 0} onClick={() => void execute()}>{busy ? "Executing..." : "Confirm refund"}</Button><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button></div>
    </div></div>}
  </div>;
}
