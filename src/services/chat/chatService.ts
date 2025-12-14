// chatService.ts
import { io, Socket } from "socket.io-client";
import { authService } from "./auth";
import type {
  ChatMessage,
  ServerMessage,
  SchedulePayload,
  CallRequestPayload,
  Product,
  LoadingEvent,
} from "./types";

type MessageHandler = (msg: ChatMessage) => void;
type ConnectionStateHandler = (isConnected: boolean) => void;
type LoadingHandler = (event: LoadingEvent) => void;

const SOCKET_CONFIG = {
  path: "/socket.io",
  reconnectionAttempts: 0, // biz o'zimiz boshqaramiz
  autoConnect: false,
  timeout: 10000,
} as const;

export const createChatService = (widgetKey: string) => {
  let socket: Socket | null = null;
  let onMessage: MessageHandler | null = null;
  let onConnectionStateChange: ConnectionStateHandler | null = null;
  let onLoading: LoadingHandler | null = null;
  let isConnecting = false;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 3;
  let hasTriedRefresh = false;

  const isOnline = () =>
    typeof navigator !== "undefined" ? navigator.onLine : true;

  const normalizeUrl = (url: string) => {
    if (!/^https?:\/\//.test(url) && !/^wss?:\/\//.test(url)) {
      url = `https://${url}`;
    }
    return url.replace(/^http/, "ws");
  };

  const getAuthToken = async (forceRefresh = false): Promise<string> => {
    return await authService.getToken(widgetKey, forceRefresh);
  };

  const transformServerMessage = (m: ServerMessage): ChatMessage => ({
    id: m.id,
    from: m.isAdmin ? "bot" : "user",
    text: m.text, // Legacy support
    question: m.question ?? null, // New field
    information: m.information ?? null, // New field
    images: m.images ?? [],
    products: m.products ?? [],
    timestamp: new Date(m.createdAt),
    isAdmin: m.isAdmin,
    description: m.description ?? null, // Legacy support
    user: m.widgetUser
      ? {
        id: m.widgetUser.id,
        name:
          [m.widgetUser.firstName, m.widgetUser.lastName]
            .filter(Boolean)
            .join(" ") || undefined,
        email: m.widgetUser.email || undefined,
      }
      : undefined,
    type: m.type,
    options: m.options ?? [],
    schedule: m.schedule ?? null,
    callRequest: m.callRequest ?? null,
    product_photo_link: m.product_photo_link ?? null,
    generated_photo: m.generated_photo ?? null,
    room_image_link: m.room_image_link ?? null,
  });

  const handleConnect = () => {
    console.info("✅ Connected");
    reconnectAttempts = 0;
    hasTriedRefresh = false;
    onConnectionStateChange?.(true);
  };

  const handleDisconnect = (reason: string) => {
    console.warn("🔌 Disconnected:", reason);
    onConnectionStateChange?.(false);

    if (!isOnline()) {
      console.warn("Skipping reconnection because browser is offline");
      return;
    }

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      setTimeout(connectWithRetry, 1000);
    } else {
      console.warn("Stopping reconnection — max attempts reached");
    }
  };

  // Check if error is a network/connection error (not 401)
  const isNetworkError = (error: Error): boolean => {
    // Check if browser is offline
    if (!isOnline()) return true;

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
      "502",
      "503",
      "504",
      "browser offline",
    ];

    return networkKeywords.some((keyword) => errorMessage.includes(keyword));
  };

  const handleConnectError = async (error: Error) => {
    console.error("Connection error:", error);

    if (!isOnline()) {
      console.warn("Skipping reconnection because browser is offline");
      onConnectionStateChange?.(false);
      return;
    }

    // Check if it's a network error
    const isNetworkErr = isNetworkError(error);

    // ✅ faqat 401 (unauthorized) bo'lsa va network error bo'lmasa, refresh token qilamiz
    // Network xatolarda (502, CORS, network) refresh qilmaymiz
    const is401Error = error.message.includes("401");

    if (is401Error && !isNetworkErr && !hasTriedRefresh) {
      hasTriedRefresh = true;
      try {
        console.log("Attempting to refresh token (401 error)...");
        const newToken = await authService.refreshAccessToken();

        if (socket) {
          socket.io.opts.extraHeaders = {
            ...socket.io.opts.extraHeaders,
            Authorization: `Bearer ${newToken}`,
          };
        }

        reconnectAttempts = 0;
        await connectWithRetry();
        return;
      } catch (refreshError) {
        console.error("❌ Token refresh failed:", refreshError);
        const refreshErrorWithStatus = refreshError as Error & {
          status?: number;
        };

        // Only clear token if refresh also failed with 401 AND not a network error
        const isRefresh401 =
          refreshErrorWithStatus?.status === 401 ||
          (refreshError as Error)?.message?.includes("401");
        const isRefreshNetworkErr = isNetworkError(refreshError as Error);

        if (isRefresh401 && !isRefreshNetworkErr) {
          authService.clearToken();
        }
        onConnectionStateChange?.(false);
        return;
      }
    }

    reconnectAttempts++;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error("Max reconnection attempts reached — stopping");
      onConnectionStateChange?.(false);
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);
    console.log(
      `Retrying connection in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
    );
    setTimeout(connectWithRetry, delay);
  };

  const attachListeners = () => {
    if (!socket) return;
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("newMessage", (data: ServerMessage) => {
      onMessage?.(transformServerMessage(data));
    });
    socket.on(
      "errorMessage",
      (data: { message?: string } | [string, { message?: string }]) => {
        // Handle both array format ["errorMessage", {message: "..."}] and object format {message: "..."}
        let errorMessage: string;
        if (Array.isArray(data)) {
          const secondElement = data[1];
          if (typeof secondElement === "string") {
            errorMessage = secondElement;
          } else if (
            secondElement &&
            typeof secondElement === "object" &&
            "message" in secondElement
          ) {
            errorMessage = secondElement.message || "An error occurred";
          } else {
            errorMessage = "An error occurred";
          }
        } else {
          errorMessage = data?.message || "An error occurred";
        }

        const errorChatMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          from: "bot",
          text: errorMessage,
          images: [],
          products: [],
          timestamp: new Date(),
          isAdmin: true,
          isError: true,
        };
        onMessage?.(errorChatMessage);
      }
    );
    socket.on(
      "newSchedule",
      (data: { schedule?: boolean; products?: Product[] }) => {
        // Handle newSchedule event - show schedule form if schedule: true
        if (data?.schedule === true) {
          const scheduleRequestMessage: ChatMessage = {
            id: `schedule-request-${Date.now()}`,
            from: "bot",
            text: "",
            images: [],
            products: data.products || [],
            timestamp: new Date(),
            isAdmin: true,
            showScheduleForm: true,
          };
          onMessage?.(scheduleRequestMessage);
        }
      }
    );
    socket.on("loading", (data: LoadingEvent | LoadingEvent[]) => {
      // Handle both single event and array of events
      const events = Array.isArray(data) ? data : [data];
      events.forEach((event) => {
        if (
          event &&
          typeof event === "object" &&
          "type" in event &&
          "loading" in event
        ) {
          onLoading?.(event as LoadingEvent);
        }
      });
    });
  };

  const cleanListeners = () => {
    if (!socket) return;
    socket.off("connect", handleConnect);
    socket.off("disconnect", handleDisconnect);
    socket.off("connect_error", handleConnectError);
    socket.off("newMessage");
    socket.off("errorMessage");
    socket.off("newSchedule");
    socket.off("loading");
  };

  const connectWithRetry = async (): Promise<void> => {
    if (isConnecting) return;

    // Don't attempt connection if browser is offline
    if (!isOnline()) {
      console.warn("Browser is offline, skipping connection attempt");
      onConnectionStateChange?.(false);
      return;
    }

    isConnecting = true;

    try {
      const token = await getAuthToken(false);
      if (!socket) throw new Error("Socket not initialized");

      socket.io.opts.extraHeaders = {
        ...socket.io.opts.extraHeaders,
        Authorization: `Bearer ${token}`,
      };

      await new Promise<void>((resolve, reject) => {
        if (!socket) return reject(new Error("Socket not initialized"));

        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, 10000);

        socket.once("connect", () => {
          clearTimeout(timeout);
          resolve();
        });

        socket.once("connect_error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });

        socket.connect();
      });
    } catch (err) {
      console.error("Connection attempt failed:", err);
      handleConnectError(err as Error);
    } finally {
      isConnecting = false;
    }
  };

  const connectSocket = async (
    url: string,
    handler: MessageHandler,
    loadingHandler?: LoadingHandler
  ) => {
    if (socket) {
      cleanListeners();
      if (socket.connected) socket.disconnect();
      socket = null;
    }

    const token = await getAuthToken();
    onMessage = handler;
    onLoading = loadingHandler || null;

    socket = io(`${normalizeUrl(url)}/widget-chat`, {
      ...SOCKET_CONFIG,
      extraHeaders: { Authorization: `Bearer ${token}` },
    });

    attachListeners();
    await connectWithRetry();
  };

  const disconnectSocket = () => {
    if (!socket) return;
    cleanListeners();
    if (socket.connected) socket.disconnect();
    socket = null;
    onMessage = null;
    onConnectionStateChange?.(false);
  };

  const sendMessage = (
    text: string,
    imageUrl: string = "",
    schedule?: SchedulePayload | null,
    callRequest?: CallRequestPayload | null
  ): Promise<ChatMessage> => {
    if (!socket) throw new Error("Socket not initialized");
    const payload: {
      text: string;
      images: string[];
      schedule?: SchedulePayload | null;
      callRequest?: CallRequestPayload | null;
    } = {
      text: text.trim(),
      images: imageUrl ? [imageUrl] : [],
    };

    if (schedule) {
      payload.schedule = schedule;
    }

    if (callRequest) {
      payload.callRequest = callRequest;
    }

    return new Promise<ChatMessage>((resolve, reject) => {
      socket!.emit("sendMessage", payload, (res: { error?: string } | null) => {
        if (res?.error) {
          if (res.error.includes("auth")) authService.clearToken();
          return reject(new Error(res.error));
        }

        const msg: ChatMessage = {
          id: Date.now().toString(),
          from: "user",
          text: text.trim(),
          images: imageUrl ? [imageUrl] : [],
          timestamp: new Date(),
          products: [],
          schedule: schedule ?? null,
          callRequest: callRequest ?? null,
        };

        resolve(msg);
      });
    });
  };

  const sendHomeGeneration = (
    homeImageUrl: string,
    productImageUrl: string,
    prompt: string = ""
  ): Promise<void> => {
    if (!socket) throw new Error("Socket not initialized");

    const payload: {
      product_photo: string;
      room_photo?: string;
      prompt?: string;
    } = {
      product_photo: productImageUrl,
    };

    // Add room_photo only if provided (optional)
    if (homeImageUrl && homeImageUrl.trim() !== "") {
      payload.room_photo = homeImageUrl;
    }

    // Add prompt only if provided (optional)
    if (prompt && prompt.trim() !== "") {
      payload.prompt = prompt;
    }

    return new Promise<void>((resolve, reject) => {
      socket!.emit(
        "homeGeneration",
        payload,
        (res: { error?: string } | null) => {
          if (res?.error) {
            if (res.error.includes("auth")) authService.clearToken();
            return reject(new Error(res.error));
          }
          resolve();
        }
      );
    });
  };

  return {
    connectSocket,
    disconnectSocket,
    sendMessage,
    sendHomeGeneration,
    isConnected: () => Boolean(socket?.connected),
    getSocketId: () => socket?.id ?? null,
    setConnectionStateHandler: (cb: ConnectionStateHandler) =>
      (onConnectionStateChange = cb),
    setLoadingHandler: (cb: LoadingHandler) => (onLoading = cb),
  };
};

export type ChatService = ReturnType<typeof createChatService>;
