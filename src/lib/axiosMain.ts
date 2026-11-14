import axios, { type AxiosRequestConfig } from "axios";
import { getRefreshToken, setTokens, clearTokens } from "@/lib/auth";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const axiosMain = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    "ngrok-skip-browser-warning": "true",
  },
});

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class InsufficientCreditsError extends ApiError {
  readonly isInsufficientCredits = true;
  constructor(message: string, status?: number, data?: unknown) {
    super(message, status, data);
    this.name = "InsufficientCreditsError";
  }
}

export const isInsufficientCreditsError = (
  err: unknown,
): err is InsufficientCreditsError =>
  typeof err === "object" &&
  err !== null &&
  (err as { isInsufficientCredits?: boolean }).isInsufficientCredits === true;

type RetryableConfig = AxiosRequestConfig & { _retried?: boolean };

// Concurrent 401s share one in-flight refresh instead of each firing their own.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw new Error("No refresh token available");
      // Plain axios (not axiosMain) so this call never recurses into this interceptor.
      const { data } = await axios.post<{
        access_token: string;
        refresh_token: string;
      }>(`${API_URL}/auth/refresh`, { refresh_token: refreshToken }, { timeout: 30000 });
      setTokens(data.access_token, data.refresh_token);
      return data.access_token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

axiosMain.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error)) {
      const config = error.config as RetryableConfig | undefined;
      const hadAuthHeader = Boolean(
        config?.headers &&
        (config.headers as Record<string, unknown>).Authorization,
      );

      let responseData = error.response?.data;
      if (
        responseData instanceof Blob &&
        error.response?.status &&
        error.response.status >= 400
      ) {
        try {
          const text = await responseData.text();
          responseData = JSON.parse(text);
        } catch {
          // fallback if not JSON
        }
      }

      const detail = responseData?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((e: { msg: string }) => e.msg).join(", ")
            : error.response?.status
              ? `Server Error: ${error.response.status} ${error.response.statusText || ""}`
              : error.message || "Request failed";

      // Role check or verification errors
      if (
        error.response?.status === 401 &&
        typeof detail === "string" &&
        (detail.includes("Email not verified") ||
          detail.includes("Account is deactivated"))
      ) {
        return Promise.reject(new ApiError(detail, 401, responseData));
      }

      if (
        error.response?.status === 401 &&
        config &&
        hadAuthHeader &&
        !config._retried
      ) {
        config._retried = true;
        try {
          const newAccessToken = await refreshAccessToken();
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${newAccessToken}`,
          };
          return axiosMain.request(config);
        } catch {
          clearTokens();
          if (typeof window !== "undefined") {
            window.location.replace("/login");
          }
        }
      }

      if (error.response?.status === 429) {
        return Promise.reject(
          new ApiError("Please slow down and try again shortly.", 429),
        );
      }

      if (error.response?.status === 402) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("insufficientCredits", { detail: message }),
          );
        }
        return Promise.reject(
          new InsufficientCreditsError(message, 402, responseData),
        );
      }

      return Promise.reject(
        new ApiError(message, error.response?.status, responseData),
      );
    }
    return Promise.reject(error);
  },
);

export default axiosMain;
