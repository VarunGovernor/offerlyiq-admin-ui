"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { admin } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { getApiErrorDetail, getApiErrorStatus } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PaymentOperations, PaymentOperation, OperationAudit } from "@/types/paymentOperations";

const labels: Record<PaymentOperation, string> = { checkout: "New payment checkouts", recurring: "New recurring subscriptions", refunds: "Refund execution" };
const environments = { local: "Local", test: "Test/Staging", production: "Production" };

export default function PaymentControls({ canModify, onChange }: { canModify: boolean; onChange?: (state: PaymentOperations) => void }) {
  const [state, setState] = useState<PaymentOperations | null>(null);
  const [audit, setAudit] = useState<OperationAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<PaymentOperation | null>(null);
  const [proposal, setProposal] = useState<{ version: number; enabled: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const generation = useRef(0);
  const changeRef = useRef(onChange);
  useEffect(() => { changeRef.current = onChange; }, [onChange]);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const token = getAccessToken() || undefined;
      const result = await admin.getPaymentOperations(token);
      if (generation.current !== current) return;
      setState(result); changeRef.current?.(result); setError("");
      if (canModify && result.can_modify) {
        const history = await admin.getPaymentOperationAudit(token);
        if (generation.current === current) setAudit(history.events);
      }
    } catch (e) {
      if (generation.current === current) setError(getApiErrorStatus(e) === 401 ? "Your session expired. Sign in again." : getApiErrorDetail(e) || "Payment controls could not be loaded. Retry to recover.");
    } finally { if (generation.current === current) setLoading(false); }
  }, [canModify]);
  useEffect(() => {
    const active = generation;
    let mounted = true;
    void Promise.resolve().then(() => { if (mounted) void load(); });
    const refresh = () => { if (!document.hidden) void load(); };
    window.addEventListener("focus", refresh);
    return () => { mounted = false; active.current++; window.removeEventListener("focus", refresh); };
  }, [load]);
  const apply = async () => {
    if (!selected || !proposal || !state || !canModify || !state.can_modify || busy || !reason.trim()) return;
    const key = selected;
    const enabled = proposal.enabled;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await admin.updatePaymentOperations(proposal.version, { [key]: enabled }, reason.trim(), enabled && state.environment === "production", getAccessToken() || undefined);
      setState(result); changeRef.current?.(result); setSelected(null); setReason("");
      await load();
      setMessage(`${labels[key]} ${enabled ? "enabled" : "disabled"}. Server state refreshed.`);
    } catch (e) {
      setError(getApiErrorDetail(e) || (getApiErrorStatus(e) === 409 ? "Settings changed in another session. Refresh and review before trying again." : "") || "Update failed. Refresh to check the server state before retrying.");
    } finally { setBusy(false); }
  };
  return <Card>
    <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Payment operations</CardTitle><Button variant="outline" onClick={() => void load()} disabled={loading || busy}>Refresh controls</Button></div></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">These controls affect new application-package operations only. Existing paid allowances, webhook processing and subscription renewals are preserved. AI-credit billing is separate.</p>
      {state && <p className="font-medium">Environment: {environments[state.environment]} <span className="text-sm font-normal text-muted-foreground">| Version {state.version}</span></p>}
      {loading && <p role="status">Loading payment controls.</p>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
      {(!canModify || (state && !state.can_modify)) && <p className="text-sm">Read-only. Only Super Admin can change payment operations.</p>}
      {state && <div className="grid gap-3 lg:grid-cols-3">{(Object.keys(labels) as PaymentOperation[]).map(key => {
        const item = state.switches[key];
        return <div key={key} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3"><h3 className="font-semibold">{labels[key]}</h3><button type="button" role="switch" aria-label={labels[key]} aria-checked={item.enabled} disabled={!canModify || !state.can_modify || loading || busy || !!error} className="shrink-0 rounded-full border px-3 py-1 text-sm font-semibold disabled:opacity-60" onClick={() => { setSelected(key); setProposal({ version: state.version, enabled: !item.enabled }); setReason(""); setMessage(""); }}>{item.enabled ? "ON" : "OFF"}</button></div>
          {key === "refunds" && !state.refund_execution_available && <p className="text-sm">Execution endpoint unavailable in this build. This switch records configuration only.</p>}
          <p className="text-sm">Effective server state: <strong>{item.effective ? "ON" : "OFF"}</strong></p>
          {item.blockers.length > 0 && <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">{item.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>}
        </div>;
      })}</div>}
      {selected && state && <div onKeyDown={event => { if (event.key === "Escape" && !busy) setSelected(null); if (event.key === "Tab") { const elements = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled)"); const first = elements[0]; const last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }} role="dialog" aria-modal="true" aria-label="Confirm payment operation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md space-y-4 rounded-xl border bg-background p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{proposal?.enabled ? "Enable" : "Disable"} {labels[selected].toLowerCase()}?</h3>
        <p className="text-sm">Environment: {environments[state.environment]}. {state.environment === "production" && proposal?.enabled ? "This permits real production operations only when deployment gates and release prerequisites allow them." : "The server checks permissions and required configuration before applying this change."}</p>
        <label className="block space-y-1"><span>Change reason</span><textarea autoFocus maxLength={1000} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} className="w-full rounded-md border bg-background p-3" /></label>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-2"><Button disabled={busy || loading || !reason.trim()} onClick={() => void apply()}>{busy ? "Saving..." : "Confirm change"}</Button><Button variant="outline" disabled={busy} onClick={() => { setSelected(null); setReason(""); }}>Cancel</Button></div>
      </div></div>}
      {canModify && state?.can_modify && <details><summary className="cursor-pointer font-medium">Payment operation audit history</summary><div className="mt-3 space-y-3">{audit.length === 0 ? <p className="text-sm">No changes recorded.</p> : audit.map(event => <div key={event.id} className="break-words rounded-lg border p-3 text-sm"><p>{new Date(event.created_at).toLocaleString()} | Actor {event.actor_user_id}</p><p>{event.reason}</p>{Object.keys(event.after).filter(key => key in labels).map(key => <p key={key}>{labels[key as PaymentOperation] ?? key}: {event.before[key] ? "ON" : "OFF"} to {event.after[key] ? "ON" : "OFF"}</p>)}</div>)}</div></details>}
    </CardContent>
  </Card>;
}
