"use client";

import { useState } from "react";
import { admin } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { getApiErrorDetail } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Execution = { id: string; status: string; provider_id: string | null; amount_minor: number; currency: string; evidence?: string };

export default function RefundExecution({ requestId }: { requestId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Execution | null>(null);
  const [environment, setEnvironment] = useState("");
  const check = async () => {
    setBusy(true); setError("");
    try {
      const state = await admin.getPaymentOperations(getAccessToken() || undefined);
      setEnvironment(state.environment);
      if (!state.switches.refunds.effective) setError(state.switches.refunds.blockers.join(" ") || "Refund execution is OFF. Reviews remain available.");
      const execution = await admin.getApplicationRefundExecution(requestId, getAccessToken() || undefined);
      if (execution?.id) setResult(execution);
    } catch (e) { setError(getApiErrorDetail(e) || "Unable to verify refund execution state. Refresh before retrying."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 border-t pt-3">
    <Button variant="outline" disabled={busy} onClick={() => void check()}>{busy ? "Checking..." : "Check refund execution"}</Button>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    {result && <div role="status" className="space-y-1 text-sm"><p>Provider refund status: {result.status}</p><p>Refund amount: {result.amount_minor} minor units ({result.currency.toUpperCase()})</p>{result.provider_id && <p className="break-all">Provider reference: {result.provider_id}</p>}</div>}
    <p className="text-sm text-muted-foreground">Refund execution is unavailable in this build. The sandbox execution endpoint is pending approval. Requests, reviews and status checks remain available.</p>
    {environment && <p className="text-sm">Environment: {environment}</p>}
  </div>;
}
