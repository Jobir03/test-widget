// auth.ts
let API_BASE = "https://admin-backend.findecor.io";
const TOKEN_KEY = "findecor_chat_token";
const REFRESH_TOKEN_KEY = "findecor_chat_refresh_token";
const COOKIE_PATH = "/";
const COOKIE_DOMAIN = window.location.hostname;

// Check if browser is online
const isOnline = () =>
  typeof navigator !== "undefined" ? navigator.onLine : true;

// Check if error is a network/connection error (not 401)
const isNetworkError = (error: Error & { status?: number }): boolean => {
  // Check if browser is offline
  if (!isOnline()) return true;

  // Check for network errors
  const status = error.status;
  if (status && status >= 500) return true; // 502, 503, 504, etc.
  if (status === 0) return true; // CORS errors

  // Check error message for network-related keywords
  const errorMessage = error?.message?.toLowerCase() || "";
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

export const getApiBase = () => API_BASE;

// Cookie utilities
const setCookie = (name: string, value: string, days = 1): void => {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=${COOKIE_PATH};domain=${COOKIE_DOMAIN};SameSite=Lax`;
};

const getCookie = (name: string): string | null => {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

const deleteCookie = (name: string): void => {
  document.cookie = `${name}=; Max-Age=-99999999; path=${COOKIE_PATH}; domain=${COOKIE_DOMAIN}`;
};

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

export interface UserData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  memory: string | null;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  lastImageUrl: string | null;
  widget: {
    id: number;
    key: string;
    color: string;
    textColor: string;
    widgetSize: string;
    position: string;
    borderRadius: string;
    companyName: string;
    isActive: boolean;
    autoOpen: boolean;
    autoDelay: boolean;
    typingIndicator: boolean;
    soundNotifications: boolean;
    headerText: string | null;
    welcomeMessage: string | null;
    offlineMessage: string | null;
    inputPlaceholder: string | null;
    buttonText: string | null;
    company: {
      id: string;
      name: string;
      description: string;
      avatar: string;
      email: string;
      imported_countries: string[];
      services: string[];
      city: string;
      country: string;
      website: string;
      businessType: string;
    };
  };
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
    // Store access token with 1 hour expiration
    setCookie(TOKEN_KEY, data.access_token, 1 / 24);
    // Store refresh token with 7 days expiration
    setCookie(REFRESH_TOKEN_KEY, data.refresh_token, 7);
    tokenListeners.forEach((cb) => cb(data.access_token));
  };

  const clearToken = (): void => {
    deleteCookie(TOKEN_KEY);
    deleteCookie(REFRESH_TOKEN_KEY);
    tokenListeners.forEach((cb) => cb(null));
  };

  const getStoredToken = (): string | null => {
    return getCookie(TOKEN_KEY);
  };

  const authenticate = async (key: string): Promise<AuthResponse> => {
    // Don't make API request if browser is offline
    if (!isOnline()) {
      throw new Error("No internet connection. Please check your network.");
    }

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
        const error = new Error(
          errorData.message || "Authentication failed"
        ) as Error & { status?: number };
        error.status = response.status;
        throw error;
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
    // Don't make API request if browser is offline
    if (!isOnline()) {
      throw new Error("No internet connection. Please check your network.");
    }

    const refreshTokenValue = getCookie(REFRESH_TOKEN_KEY);
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
        // Preserve status code in error for proper handling
        const error = new Error(
          errorData.message || "Token refresh failed"
        ) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      setTokenData(data);
      return data.access_token;
    } catch (error) {
      console.error("Token refresh error:", error);
      const errorWithStatus = error as Error & { status?: number };

      // Only clear token if it's a 401 error (unauthorized) AND not a network error
      // For network errors (502, CORS, network), keep token and let caller handle
      if (errorWithStatus?.status === 401 && !isNetworkError(errorWithStatus)) {
        clearToken();
      }
      throw error;
    }
  };

  const getToken = async (
    key?: string,
    forceRefresh = false
  ): Promise<string> => {
    const storedToken = getCookie(TOKEN_KEY);
    const currentWidgetKey = key || widgetKey;

    // If token exists and not forcing refresh, return it
    if (!forceRefresh && storedToken) return storedToken;

    const hasRefresh = Boolean(getCookie(REFRESH_TOKEN_KEY));

    // If refresh token exists, try to refresh (either forceRefresh or token expired)
    if (hasRefresh) {
      try {
        return await refreshAccessToken();
      } catch (error) {
        const errorWithStatus = error as Error & { status?: number };

        // Check if it's a network error
        const isNetworkErr = isNetworkError(errorWithStatus);

        // Only retry auth if refresh token failed with 401 (unauthorized) AND not a network error
        // For network errors (502, CORS, network), throw without retrying
        const is401Error =
          errorWithStatus?.status === 401 ||
          (error as Error)?.message?.includes("401");

        if (is401Error && !isNetworkErr && currentWidgetKey) {
          const authData = await authenticate(currentWidgetKey);
          return authData.access_token;
        }
        throw error;
      }
    }

    // No refresh token available, authenticate with widget key
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

  const getUser = async (): Promise<UserData> => {
    // Don't make API request if browser is offline
    if (!isOnline()) {
      throw new Error("No internet connection. Please check your network.");
    }

    const token = await getToken();
    if (!token) {
      throw new Error("No authentication token available");
    }

    try {
      const url = `${API_BASE}/widget-users/me`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: "Failed to fetch user data",
        }));
        const error = new Error(
          errorData.message || "Failed to fetch user data"
        ) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Get user error:", error);
      throw error;
    }
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
    getToken,
    clearToken,
    getStoredToken,
    getUser,
    onTokenChanged,
    onBaseUrlChanged,
  };
};

export const authService = createAuthService();
export default authService;
