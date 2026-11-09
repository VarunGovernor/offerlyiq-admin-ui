import type { TokenResponse, User, MessageResponse } from "@/types/auth";
import axiosMain from "@/lib/axiosMain";
import type { AppPlatform, AppSlot, AppUploadTicket } from "@/types/app-downloads";
import type {
  AdminPackageCatalog,
  AdminPaymentStatus,
  AdminUsageHistory,
  UserAllowanceReport,
} from "@/types/applicationPackages";

function authHeader(accessToken: string) {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

export async function login(
  email: string,
  password: string,
): Promise<TokenResponse> {
  const { data } = await axiosMain.post<TokenResponse>("/auth/login", {
    email,
    password,
  });
  return data;
}

export async function getCurrentUser(accessToken: string): Promise<User> {
  const { data } = await axiosMain.get<User>(
    "/users/me",
    authHeader(accessToken),
  );
  return data;
}

export async function logout(
  refreshToken: string,
  accessToken: string,
): Promise<void> {
  await axiosMain.post(
    "/auth/logout",
    { refresh_token: refreshToken },
    authHeader(accessToken),
  );
}

export async function resendVerification(
  email: string,
): Promise<MessageResponse> {
  const { data } = await axiosMain.post<MessageResponse>(
    "/auth/resend-verification",
    { email },
  );
  return data;
}

const authConfig = (token?: string) =>
  token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;

export const admin = {
  // Analytics
  overview: (
    token?: string,
    params?: { days?: number; since?: string; until?: string } | number,
  ) => {
    const queryParams = typeof params === "number" ? { days: params } : params;
    return axiosMain
      .get("/admin/analytics/overview", {
        ...authConfig(token),
        params: queryParams,
      })
      .then((r) => r.data);
  },
  revenue: (token?: string, days?: number) =>
    axiosMain
      .get("/admin/analytics/revenue", { ...authConfig(token), params: days ? { days } : undefined })
      .then((r) => r.data),
  getRevenueUsd: (token?: string, days = 30) =>
    axiosMain
      .get("/admin/analytics/revenue/usd", { ...authConfig(token), params: { days } })
      .then((r) => r.data),
  getPlanSalesUsd: (token?: string) =>
    axiosMain.get("/admin/analytics/plans/usd", authConfig(token)).then((r) => r.data),
  // Users
  getUsers: (token?: string, page = 1, size = 20, q?: string, role?: string, is_active?: string) =>
    axiosMain
      .get("/admin/users", {
        ...authConfig(token),
        params: { page, size, ...(q ? { q } : {}), ...(role && role !== "all" ? { role } : {}), ...(is_active && is_active !== "all" ? { is_active: is_active === "active" } : {}) },
      })
      .then((r) => r.data),
  updateUserStatus: (
    id: string,
    status: string,
    reason: string,
    token?: string,
  ) =>
    axiosMain
      .patch(`/admin/users/${id}/status`, { is_active: status === "active", reason }, authConfig(token))
      .then((r) => r.data),
  updateUserRole: (id: string, role: string, reason: string, token?: string) =>
    axiosMain
      .patch(`/admin/users/${id}/role`, { role, reason }, authConfig(token))
      .then((r) => r.data),
  getUserDetail: (id: string, token?: string) =>
    axiosMain
      .get(`/admin/users/${id}`, authConfig(token))
      .then((r) => r.data),
  getUserLedger: (id: string, token?: string) =>
    axiosMain
      .get(`/admin/users/${id}/ledger`, authConfig(token))
      .then((r) => r.data),
  getUserTransactions: (id: string, token?: string) =>
    axiosMain
      .get(`/admin/users/${id}/transactions`, authConfig(token))
      .then((r) => r.data),
  grantUserCredits: (
    id: string,
    delta: number,
    reason: string,
    expires_in_days?: number,
    token?: string,
  ) =>
    axiosMain
      .post(`/admin/users/${id}/credits`, { delta, reason, expires_in_days }, authConfig(token))
      .then((r) => r.data),

  userMargin: (
    id: string,
    token?: string,
    params?: { since?: string; until?: string },
  ) =>
    axiosMain
      .get(`/admin/analytics/users/${id}/margin`, {
        ...authConfig(token),
        params,
      })
      .then((r) => r.data),
  reinstateUser: (id: string, reason: string, token?: string) =>
    axiosMain
      .post(`/admin/billing/users/${id}/reinstate`, { reason }, authConfig(token))
      .then((r) => r.data),
  deleteUser: (id: string, reason: string, token?: string) =>
    axiosMain
      .delete(`/admin/users/${id}`, {
        ...authConfig(token),
        data: { reason },
      })
      .then((r) => r.data),

  // Plans
  getPlans: (token?: string) =>
    axiosMain.get("/admin/plans", authConfig(token)).then((r) => r.data),
  createPlan: (data: Record<string, unknown>, token?: string) =>
    axiosMain.post("/admin/plans", data, authConfig(token)).then((r) => r.data),
  updatePlan: (id: string, data: Record<string, unknown>, token?: string) =>
    axiosMain
      .patch(`/admin/plans/${id}`, data, authConfig(token))
      .then((r) => r.data),
  deletePlan: (id: string, token?: string) =>
    axiosMain
      .delete(`/admin/plans/${id}`, authConfig(token))
      .then((r) => r.data),
  updatePlanPrices: (id: string, data: unknown, token?: string) =>
    axiosMain
      .put(`/admin/plans/${id}/prices`, data, authConfig(token))
      .then((r) => r.data),
  updatePlanFeatures: (id: string, data: unknown, token?: string) =>
    axiosMain
      .put(`/admin/plans/${id}/features`, data, authConfig(token))
      .then((r) => r.data),
  publishPlan: (id: string, token?: string) =>
    axiosMain
      .post(`/admin/plans/${id}/publish`, undefined, authConfig(token))
      .then((r) => r.data),
  unpublishPlan: (id: string, token?: string) =>
    axiosMain
      .post(`/admin/plans/${id}/unpublish`, undefined, authConfig(token))
      .then((r) => r.data),
  archivePlan: (id: string, token?: string) =>
    axiosMain
      .post(`/admin/plans/${id}/archive`, undefined, authConfig(token))
      .then((r) => r.data),
  updatePlanHighlights: (id: string, data: unknown[], token?: string) =>
    axiosMain
      .put(`/admin/plans/${id}/highlights`, data, authConfig(token))
      .then((r) => r.data),
  getBillingCosts: (token?: string) =>
    axiosMain.get("/billing/costs", authConfig(token)).then((r) => r.data),

  // Catalog
  getModules: (token?: string) =>
    axiosMain.get("/admin/modules", authConfig(token)).then((r) => r.data),
  patchModule: (code: string, data: Record<string, unknown>, token?: string) =>
    axiosMain
      .patch(`/admin/modules/${code}`, data, authConfig(token))
      .then((r) => r.data),
  getFeatures: (token?: string) =>
    axiosMain.get("/admin/features", authConfig(token)).then((r) => r.data),
  getSettings: (token?: string) =>
    axiosMain.get("/admin/settings", authConfig(token)).then((r) => r.data),
  patchSetting: (key: string, data: Record<string, unknown>, token?: string) =>
    axiosMain
      .patch(`/admin/settings/${key}`, data, authConfig(token))
      .then((r) => r.data),

  // Discounts
  getDiscounts: (token?: string) =>
    axiosMain.get("/admin/discounts", authConfig(token)).then((r) => r.data),
  createDiscount: (data: Record<string, unknown>, token?: string) =>
    axiosMain
      .post("/admin/discounts", data, authConfig(token))
      .then((r) => r.data),
  updateDiscount: (id: string, data: Record<string, unknown>, token?: string) =>
    axiosMain
      .patch(`/admin/discounts/${id}`, data, authConfig(token))
      .then((r) => r.data),
  deleteDiscount: (id: string, token?: string) =>
    axiosMain
      .delete(`/admin/discounts/${id}`, authConfig(token))
      .then((r) => r.data),

  // Billing Ops
  getWebhooks: (token?: string, page = 1, size = 10, filters?: { status?: string, eventType?: string, since?: string, until?: string }) => {
    const params: Record<string, unknown> = { page, size };
    if (filters?.status && filters.status !== "all") params.status = filters.status;
    if (filters?.eventType && filters.eventType !== "all") params.event_type = filters.eventType;
    if (filters?.since) params.since = filters.since;
    if (filters?.until) params.until = filters.until;
    return axiosMain
      .get("/admin/billing/webhooks", {
        ...authConfig(token),
        params,
      })
      .then((r) => r.data);
  },
  getWebhookDetail: (id: string, token?: string) =>
    axiosMain
      .get(`/admin/billing/webhooks/${id}`, authConfig(token))
      .then((r) => r.data),
  replayWebhook: (id: string, token?: string) =>
    axiosMain
      .post(`/admin/billing/webhooks/${id}/replay`, {}, authConfig(token))
      .then((r) => r.data),
  getTransactions: (
    token?: string,
    page = 1,
    size = 10,
    filters?: {
      q?: string;
      status?: string;
      plan?: string;
      currency?: string;
      since?: string;
      until?: string;
    },
  ) => {
    const params: Record<string, string | number> = { page, size };
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (value && value !== "all") params[key] = value;
    });
    return axiosMain
      .get("/admin/billing/transactions", { ...authConfig(token), params })
      .then((r) => r.data);
  },
  getTransactionFilters: (token?: string) =>
    axiosMain
      .get("/admin/billing/transactions/filters", authConfig(token))
      .then((r) => r.data),
  getChargebacks: (
    token?: string,
    page = 1,
    size = 10,
    filters?: {
      q?: string;
      since?: string;
      until?: string;
    },
  ) => {
    const params: Record<string, string | number> = { page, size };
    Object.entries(filters ?? {}).forEach(([key, value]) => {
      if (value && value !== "all") params[key] = value;
    });
    return axiosMain
      .get("/admin/billing/chargebacks", { ...authConfig(token), params })
      .then((r) => r.data);
  },
  refundTransaction: (id: string, reason: string, token?: string) =>
    axiosMain
      .post(
        `/admin/billing/transactions/${id}/refund`,
        { reason },
        authConfig(token),
      )
      .then((r) => r.data),
  creditFlow: (token?: string, days?: number) =>
    axiosMain
      .get("/admin/analytics/credits", {
        ...authConfig(token),
        params: { days },
      })
      .then((r) => r.data),
  moduleUsage: (token?: string, days?: number) =>
    axiosMain
      .get("/admin/analytics/modules", {
        ...authConfig(token),
        params: { days },
      })
      .then((r) => r.data),
  planSales: (token?: string, days?: number) =>
    axiosMain
      .get("/admin/analytics/plans", {
        ...authConfig(token),
        params: { days },
      })
      .then((r) => r.data),

  // Discounts Extensions
  getDiscountRedemptions: (id: string, token?: string) =>
    axiosMain
      .get(`/admin/discounts/${id}/redemptions`, authConfig(token))
      .then((r) => r.data),

  // Audit log
  getAuditLog: (token?: string, params?: { actor_user_id?: string; action?: string; target_type?: string; target_id?: string; since?: string; until?: string; page?: number; size?: number }) =>
    axiosMain.get("/admin/audit", { ...authConfig(token), params }).then((r) => r.data),
  getAuditActions: (token?: string) =>
    axiosMain.get("/admin/audit/actions", authConfig(token)).then((r) => r.data),

  // Support tickets
  getTickets: (token?: string, params?: { status?: string; category?: string; q?: string; user_id?: string; page?: number; size?: number }) =>
    axiosMain.get("/admin/tickets", { ...authConfig(token), params }).then((r) => r.data),
  getTicketsSummary: (token?: string) =>
    axiosMain.get("/admin/tickets/summary", authConfig(token)).then((r) => r.data),
  getTicket: (id: string, token?: string) =>
    axiosMain.get(`/admin/tickets/${id}`, authConfig(token)).then((r) => r.data),
  updateTicket: (id: string, data: { status?: string; admin_note?: string | null }, token?: string) =>
    axiosMain.patch(`/admin/tickets/${id}`, data, authConfig(token)).then((r) => r.data),

  // Desktop app downloads — see uploadToStorage() for the file itself
  getAppDownloads: (token?: string): Promise<AppSlot[]> =>
    axiosMain.get("/admin/app-downloads", authConfig(token)).then((r) => r.data),
  createAppUploadUrl: (
    platform: AppPlatform,
    data: { file_name: string; size_bytes?: number },
    token?: string,
  ): Promise<AppUploadTicket> =>
    axiosMain
      .post(`/admin/app-downloads/${platform}/upload-url`, data, authConfig(token))
      .then((r) => r.data),
  publishAppDownload: (platform: AppPlatform, objectKey: string, token?: string): Promise<AppSlot> =>
    axiosMain
      .put(`/admin/app-downloads/${platform}`, { object_key: objectKey }, authConfig(token))
      .then((r) => r.data),
  removeAppDownload: (platform: AppPlatform, token?: string): Promise<void> =>
    axiosMain.delete(`/admin/app-downloads/${platform}`, authConfig(token)).then(() => undefined),

  // Application packages — READ-ONLY draft commerce surface (Stage 5 contract).
  // Independent of AI credit plans: never publishes, prices, activates charges
  // or mutates anything. Backend refuses these routes with 404 when
  // APPLICATION_COMMERCE_ENABLED=false, 403 for non-admins.
  getApplicationPackages: (token?: string): Promise<AdminPackageCatalog> =>
    axiosMain.get("/admin/application-packages", authConfig(token)).then((r) => r.data),
  getApplicationPackageUserReport: (userId: string, token?: string): Promise<UserAllowanceReport> =>
    axiosMain
      .get(`/admin/application-packages/users/${userId}`, authConfig(token))
      .then((r) => r.data),
  getApplicationPackageUserUsage: (userId: string, token?: string): Promise<AdminUsageHistory> =>
    axiosMain
      .get(`/admin/application-packages/users/${userId}/usage`, authConfig(token))
      .then((r) => r.data),
  getApplicationPackageUserPayments: (userId: string, token?: string): Promise<AdminPaymentStatus> =>
    axiosMain
      .get(`/admin/application-packages/users/${userId}/payments`, authConfig(token))
      .then((r) => r.data),
};

/**
 * PUT a file straight to cloud storage through a signed URL.
 *
 * Plain XHR rather than axiosMain: the request goes to storage, not our API, so it must
 * carry no Authorization header and no base URL — and XHR is what reports upload
 * progress. Send exactly the headers the API returned, or storage rejects the PUT.
 */
export function uploadToStorage(
  ticket: AppUploadTicket,
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(ticket.method, ticket.upload_url);
    for (const [name, value] of Object.entries(ticket.headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else
        reject(
          new Error(
            xhr.status === 403
              ? "Storage refused the upload — the link may have expired. Try again."
              : `Upload failed (${xhr.status})`,
          ),
        );
    };
    xhr.onerror = () => reject(new Error("Upload failed — check your connection and try again."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}
