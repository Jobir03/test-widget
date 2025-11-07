let API_BASE = "https://admin-backend.findecor.io";
const TOKEN_KEY = "findecor_chat_token";
const REFRESH_TOKEN_KEY = "findecor_chat_refresh_token";

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

const createAuthService = () => {
  let widgetKey: string | null = null;
  let isAuthenticating = false;
  const tokenListeners = new Set<(token: string | null) => void>();
  const baseUrlListeners = new Set<(baseUrl: string) => void>();

  const setWidgetKey = (key: string): void => {
    widgetKey = key;
  };

  const setBaseUrl = (baseUrl: string): void => {
    API_BASE = baseUrl.replace(/\/$/, "");
    baseUrlListeners.forEach((cb) => cb(API_BASE));
  };

  const setTokenData = (data: AuthResponse): void => {
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    tokenListeners.forEach((cb) => cb(data.access_token));
  };

  const clearToken = (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    tokenListeners.forEach((cb) => cb(null));
  };

  const getStoredToken = (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  };

  const authenticate = async (key: string): Promise<AuthResponse> => {
    if (isAuthenticating) {
      return new Promise((resolve, reject) => {
        const checkAuth = () => {
          if (!isAuthenticating) {
            const storedToken = getStoredToken();
            if (storedToken) {
              resolve({
                access_token: storedToken,
                refresh_token: localStorage.getItem(REFRESH_TOKEN_KEY) || "",
              });
            } else {
              reject(new Error("Authentication failed"));
            }
          } else {
            setTimeout(checkAuth, 100);
          }
        };
        checkAuth();
      });
    }

    isAuthenticating = true;
    try {
      setWidgetKey(key);
      const url = `${API_BASE}/widget-auth/authenticate`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ widgetKey: key }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: "Authentication failed",
        }));
        throw new Error(errorData.message || "Authentication failed");
      }

      const data = await response.json();
      setTokenData(data);
      return data;
    } catch (error) {
      console.error("Authentication error:", error);
      throw error;
    } finally {
      isAuthenticating = false;
    }
  };

  const refreshAccessToken = async (): Promise<string> => {
    const refreshTokenValue = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshTokenValue) {
      throw new Error("No refresh token available");
    }

    try {
      const url = `${API_BASE}/widget-auth/refresh-token`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshTokenValue }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: "Token refresh failed",
        }));
        throw new Error(errorData.message || "Token refresh failed");
      }

      const data = await response.json();
      setTokenData(data);
      return data.access_token;
    } catch (error) {
      console.error("Token refresh error:", error);
      if (
        error instanceof Error &&
        (error.message.includes("401") ||
          error.message.includes("403") ||
          error.message.includes("Unauthorized") ||
          error.message.includes("Forbidden"))
      ) {
        clearToken();
      }
      throw error;
    }
  };

  const getToken = async (
    key?: string,
    forceRefresh = false
  ): Promise<string> => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const currentWidgetKey = key || widgetKey;

    if (!forceRefresh && storedToken) return storedToken;

    const hasRefresh = Boolean(localStorage.getItem(REFRESH_TOKEN_KEY));
    if (forceRefresh && hasRefresh) {
      try {
        return await refreshAccessToken();
      } catch (error) {
        if (currentWidgetKey) {
          const authData = await authenticate(currentWidgetKey);
          return authData.access_token;
        }
        throw error;
      }
    }

    if (currentWidgetKey) {
      const authData = await authenticate(currentWidgetKey);
      return authData.access_token;
    }

    throw new Error("No authentication method available");
  };

  const onTokenChanged = (cb: (token: string | null) => void): (() => void) => {
    tokenListeners.add(cb);
    return () => tokenListeners.delete(cb);
  };
  const onBaseUrlChanged = (cb: (baseUrl: string) => void): (() => void) => {
    baseUrlListeners.add(cb);
    return () => baseUrlListeners.delete(cb);
  };

  return {
    setBaseUrl,
    setWidgetKey,
    authenticate,
    refreshAccessToken,
    refreshToken: refreshAccessToken,
    getToken,
    clearToken,
    getStoredToken,
    onTokenChanged,
    onBaseUrlChanged,
  };
};

export const authService = createAuthService();
export default authService;
