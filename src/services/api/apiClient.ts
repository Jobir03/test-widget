import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  AxiosError,
} from "axios";
import { authService } from "../chat/auth";

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token!)
  );
  failedQueue = [];
};

// Check if browser is online
const isOnline = () =>
  typeof navigator !== "undefined" ? navigator.onLine : true;

// Check if error is a network/connection error (not 401)
const isNetworkError = (error: AxiosError | Error): boolean => {
  // Check if browser is offline
  if (!isOnline()) return true;

  // Check for network errors (no response from server)
  if (axios.isAxiosError(error)) {
    // Network errors (CORS, timeout, connection refused, etc.)
    if (!error.response) return true;
    
    // Server errors that are not 401 (502, 503, 504, etc.)
    const status = error.response.status;
    if (status >= 500 || status === 0) return true;
    
    // CORS errors typically have status 0
    if (status === 0) return true;
  }

  // Check error message for network-related keywords
  const errorMessage = (error as Error)?.message?.toLowerCase() || "";
  const networkKeywords = [
    "network",
    "timeout",
    "cors",
    "connection",
    "refused",
    "failed to fetch",
    "networkerror",
  ];
  
  return networkKeywords.some((keyword) => errorMessage.includes(keyword));
};

export interface ApiClient extends AxiosInstance {
  get<T = unknown>(url: string, config?: Record<string, unknown>): Promise<T>;
  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: Record<string, unknown>
  ): Promise<T>;
  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: Record<string, unknown>
  ): Promise<T>;
  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: Record<string, unknown>
  ): Promise<T>;
  delete<T = unknown>(
    url: string,
    config?: Record<string, unknown>
  ): Promise<T>;
}

export const createApiClient = (
  baseURL: string,
  widgetKey?: string
): ApiClient => {
  const instance = axios.create({
    baseURL,
    timeout: 50000,
  });

  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // Don't make any API requests if browser is offline
      if (!isOnline()) {
        return Promise.reject(
          new Error("No internet connection. Please check your network.")
        );
      }

      if (!config.url?.includes("widget-auth")) {
        const token = await authService.getToken(widgetKey);
        if (token) config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: AxiosError) => Promise.reject(error)
  );

  instance.interceptors.response.use(
    (response: AxiosResponse) => response.data,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      if (error.response?.status !== 401 || originalRequest._retry) {
        if (error.response?.status === 401) {
          console.error("⚠️ Unauthorized (401):", error.message);
        }
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return instance(originalRequest);
          })
          .catch(Promise.reject);
      }

      isRefreshing = true;
      try {
        const newToken = await authService.refreshAccessToken();
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return instance(originalRequest);
      } catch (refreshError) {
        // Check if it's a network error (502, CORS, timeout, etc.)
        const isNetworkErr = isNetworkError(
          refreshError as AxiosError | Error
        );
        
        // Check if it's a 401 error (unauthorized)
        const is401Error =
          (refreshError as AxiosError)?.response?.status === 401 ||
          (refreshError as Error & { status?: number })?.status === 401 ||
          (refreshError as Error)?.message?.includes("401");

        // Only retry auth if refresh token failed with 401 (unauthorized)
        // For network errors (502, CORS, network, etc.), reject without retrying auth or clearing tokens
        if (is401Error && !isNetworkErr && widgetKey) {
          try {
            const authData = await authService.authenticate(widgetKey);
            if (authData?.access_token) {
              processQueue(null, authData.access_token);
              originalRequest.headers.Authorization = `Bearer ${authData.access_token}`;
              return instance(originalRequest);
            }
          } catch (reauthErr) {
            processQueue(reauthErr, null);
            // Only clear token if re-auth also failed with 401 (not network error)
            const isReauth401 =
              (reauthErr as AxiosError)?.response?.status === 401 ||
              (reauthErr as Error & { status?: number })?.status === 401;
            if (isReauth401 && !isNetworkError(reauthErr as AxiosError | Error)) {
              authService.clearToken();
            }
            console.error("❌ Token refresh and re-auth failed:", reauthErr);
            return Promise.reject(reauthErr);
          }
        }

        // For network errors (502, CORS, network, etc.), reject without clearing tokens
        // For other non-401 errors, also reject without clearing tokens
        processQueue(refreshError, null);
        if (isNetworkErr) {
          console.error("❌ Token refresh failed (network error):", refreshError);
        } else {
          console.error("❌ Token refresh failed (non-401 error):", refreshError);
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
  );

  return instance as ApiClient;
};
