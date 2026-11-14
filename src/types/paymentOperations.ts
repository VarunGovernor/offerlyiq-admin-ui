export type PaymentOperation = "checkout" | "recurring" | "refunds";
export type OperationState = { enabled: boolean; effective: boolean; blockers: string[] };
export type PaymentOperations = {
  environment: "local" | "test" | "production";
  version: number;
  can_modify: boolean;
  refund_execution_available: boolean;
  switches: Record<PaymentOperation, OperationState>;
};
export type OperationAudit = { id: string; actor_user_id: string; created_at: string; before: Record<string, boolean>; after: Record<string, boolean>; reason: string };
