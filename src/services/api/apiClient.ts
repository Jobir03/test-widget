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
    timeout: 10000,
  });

  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
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
      } catch {
        try {
          const authData = widgetKey
            ? await authService.authenticate(widgetKey)
            : null;
          if (authData?.access_token) {
            processQueue(null, authData.access_token);
            originalRequest.headers.Authorization = `Bearer ${authData.access_token}`;
            return instance(originalRequest);
          }
        } catch (reauthErr) {
          processQueue(reauthErr, null);
          authService.clearToken();
          console.error("❌ Token refresh and re-auth failed:", reauthErr);
          return Promise.reject(reauthErr);
        }
      } finally {
        isRefreshing = false;
      }
    }
  );

  return instance as ApiClient;
};
