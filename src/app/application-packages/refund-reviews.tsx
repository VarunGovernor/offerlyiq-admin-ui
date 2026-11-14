"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import RefundExecution from "./refund-execution";
import { admin } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { getApiErrorDetail } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Review = { id: string; purchase_id: string; user_id: string; status: string; reason: string; assessment?: { state?: string }; review_reason?: string | null; created_at: string };

export default function RefundReviews({ canReview }: { canReview: boolean }) {
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const version = useRef(0);
  const load = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    try {
      const data = await admin.getApplicationRefundRequests(getAccessToken() || undefined);
      if (version.current === current) { setRows(data.requests ?? []); setError(""); }
    } catch (e) { if (version.current === current) setError(getApiErrorDetail(e) || "Unable to load refund requests."); }
    finally { if (version.current === current) setLoading(false); }
  }, []);
  useEffect(() => { const active = version; let mounted = true; void Promise.resolve().then(() => { if (mounted) void load(); }); return () => { mounted = false; active.current++; }; }, [load]);
  const review = async (decision: "approved" | "rejected") => {
    if (!canReview || !selected || !reason.trim() || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await admin.reviewApplicationRefund(selected, decision, reason.trim(), getAccessToken() || undefined);
      setSelected(null); setReason(""); setMessage(`Review ${decision}. No refund transaction was issued.`);
      await load();
    } catch (e) { setError(getApiErrorDetail(e) || "Review failed. Refresh to check the current state before retrying."); }
    finally { setBusy(false); }
  };
  return <Card>
    <CardHeader><div className="flex flex-wrap justify-between gap-2"><CardTitle>Refund review requests</CardTitle><Button variant="outline" disabled={loading || busy} onClick={() => void load()}>Refresh requests</Button></div></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Daily and other application packages can request review. Proposed usage thresholds are not production-approved policy. Uncertain submissions require reconciliation. Approval records a review decision only, not a refund or an allowance revocation.</p>
      {!canReview && <p className="text-sm">Super Admin access is required to approve or reject requests.</p>}
      {loading && <p role="status">Loading requests.</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!loading && !error && rows.length === 0 && <p>No refund requests.</p>}
      {rows.map(row => <div key={row.id} className="space-y-2 rounded-lg border p-4 break-words">
        <p className="font-semibold">{row.status}</p><p className="text-sm">Purchase: {row.purchase_id}</p><p className="text-sm">Customer: {row.user_id}</p><p>{row.reason}</p>
        <p className="text-sm text-muted-foreground">Requested {new Date(row.created_at).toLocaleString()}</p>
        {row.assessment?.state && <p>Assessment: {row.assessment.state.replaceAll("_", " ")}</p>}
        {row.review_reason && <p>Review reason: {row.review_reason}</p>}
        {canReview && row.status === "pending" && (selected === row.id ? <div className="space-y-2"><label className="block space-y-1"><span>Decision reason</span><textarea maxLength={1000} disabled={busy} className="w-full rounded-md border bg-background p-3" value={reason} onChange={event => setReason(event.target.value)} /></label><div className="flex flex-wrap gap-2"><Button disabled={busy || !reason.trim()} onClick={() => void review("approved")}>Approve review</Button><Button variant="outline" disabled={busy || !reason.trim()} onClick={() => void review("rejected")}>Reject review</Button><Button variant="outline" disabled={busy} onClick={() => { setSelected(null); setReason(""); }}>Cancel</Button></div></div> : <Button variant="outline" disabled={busy || loading} onClick={() => { setSelected(row.id); setReason(""); }}>Review request</Button>)}
        {canReview && row.status === "approved" && <RefundExecution requestId={row.id} />}
      </div>)}
    </CardContent>
  </Card>;
}
