import { io, Socket } from "socket.io-client";
import { authService } from "./auth";
import type { ChatMessage, ServerMessage } from "./types";

type MessageHandler = (msg: ChatMessage) => void;
type ConnectionStateHandler = (isConnected: boolean) => void;

const SOCKET_CONFIG = {
  path: "/socket.io",
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  autoConnect: false,
} as const;

export const createChatService = (widgetKey: string) => {
  let socket: Socket | null = null;
  let onMessage: MessageHandler | null = null;
  let onConnectionStateChange: ConnectionStateHandler | null = null;
  let isConnecting = false;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 3;

  const normalizeUrl = (url: string) => {
    if (!/^https?:\/\//.test(url) && !/^wss?:\/\//.test(url)) {
      url = `https://${url}`;
    }
    return url.replace(/^http/, "ws");
  };

  const getAuthToken = async (forceRefresh = false): Promise<string> => {
    try {
      return await authService.getToken(widgetKey, forceRefresh);
    } catch (error) {
      console.error("Failed to get auth token:", error);
      throw error;
    }
  };

  const transformServerMessage = (m: ServerMessage): ChatMessage => ({
    id: m.id,
    from: m.isAdmin ? "bot" : "user",
    text: m.text,
    images: m.images ?? [],
    products: m.products ?? [],
    timestamp: new Date(m.createdAt),
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
  });

  const handleConnect = () => {
    console.info("✅ Connected");
    reconnectAttempts = 0;
    onConnectionStateChange?.(true);
  };

  const handleDisconnect = (reason: string) => {
    console.warn("🔌 Disconnected:", reason);
    onConnectionStateChange?.(false);

    if (
      reason === "io server disconnect" ||
      reason === "io client disconnect"
    ) {
      setTimeout(connectWithRetry, 1000);
    }
  };

  const handleConnectError = async (error: Error) => {
    if (error.message.includes("401") || error.message.includes("403")) {
      try {
        const newToken = await getAuthToken(true);

        if (socket) {
          socket.io.opts.extraHeaders = {
            ...socket.io.opts.extraHeaders,
            Authorization: `Bearer ${newToken}`,
          };
          if (!socket.connected && !isConnecting) {
            await connectWithRetry();
          }
        }
      } catch (refreshError: unknown) {
        console.error("Failed to refresh token:", refreshError);
        authService.clearToken();
        onConnectionStateChange?.(false);
      }
    }
  };

  const attachListeners = () => {
    if (!socket) return;

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("connect_timeout", () => console.warn("⌛ Connection timeout"));
    socket.on("reconnect_attempt", (attempt) =>
      console.log(`Reconnect attempt ${attempt}`)
    );
    socket.on("reconnect_failed", () =>
      console.error("Reconnection failed after all attempts")
    );

    socket.on("newMessage", (data: ServerMessage) => {
      onMessage?.(transformServerMessage(data));
    });
  };

  const cleanListeners = () => {
    if (!socket) return;

    socket.off("connect", handleConnect);
    socket.off("disconnect", handleDisconnect);
    socket.off("connect_error", handleConnectError);
    socket.off("connect_timeout");
    socket.off("reconnect_attempt");
    socket.off("reconnect_failed");
    socket.off("newMessage");
  };

  const connectWithRetry = async (): Promise<void> => {
    if (!socket || isConnecting) return;

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;

    isConnecting = true;
    reconnectAttempts++;

    try {
      const token = await getAuthToken(false);

      if (socket) {
        socket.io.opts.extraHeaders = {
          ...socket.io.opts.extraHeaders,
          Authorization: `Bearer ${token}`,
        };

        if (!socket.connected) {
          await new Promise<void>((resolve, reject) => {
            if (!socket) return reject(new Error("Socket not initialized"));

            const timeout = setTimeout(() => {
              socket?.off("connect", onConnect);
              reject(new Error("Connection timeout"));
            }, 10000);

            const onConnect = () => {
              clearTimeout(timeout);
              resolve();
            };

            socket.once("connect", onConnect);
            socket.connect();
          });
        }
      }
    } catch (error) {
      console.error("Connection error:", error);

      if (
        error instanceof Error &&
        (error.message.includes("401") || error.message.includes("403"))
      ) {
        authService.clearToken();
      }

      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      console.log(`Retrying connection in ${delay}ms...`);

      setTimeout(() => {
        connectWithRetry();
      }, delay);

      throw error;
    } finally {
      isConnecting = false;
    }
  };

  const connectSocket = async (url: string, handler: MessageHandler) => {
    if (socket) {
      cleanListeners();
      if (socket.connected) {
        socket.disconnect();
      }
      socket = null;
    }

    const token = await getAuthToken();
    onMessage = handler;

    socket = io(`${normalizeUrl(url)}/widget-chat`, {
      ...SOCKET_CONFIG,
      extraHeaders: { Authorization: `Bearer ${token}` },
    });

    attachListeners();

    authService.onTokenChanged(async (newToken) => {
      if (!socket) return;
      socket.io.opts.extraHeaders = {
        ...socket.io.opts.extraHeaders,
        ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
      };
      if (newToken && !socket.connected && !isConnecting) {
        await connectWithRetry();
      }
    });

    await connectWithRetry();
  };

  const disconnectSocket = () => {
    if (!socket) return;

    cleanListeners();

    if (socket.connected) {
      socket.disconnect();
    }

    socket = null;
    onMessage = null;
    onConnectionStateChange?.(false);
  };

  const reconnectSocket = async (
    url: string,
    handler?: MessageHandler
  ): Promise<void> => {
    reconnectAttempts = 0;
    isConnecting = false;

    if (handler) {
      onMessage = handler;
    }

    if (socket) {
      cleanListeners();
      if (socket.connected) {
        socket.disconnect();
      }
      socket = null;
    }

    const token = await getAuthToken();
    socket = io(`${normalizeUrl(url)}/widget-chat`, {
      ...SOCKET_CONFIG,
      extraHeaders: { Authorization: `Bearer ${token}` },
    });

    attachListeners();

    await connectWithRetry();
  };

  const setConnectionStateHandler = (handler: ConnectionStateHandler) => {
    onConnectionStateChange = handler;
  };

  const sendMessage = (
    text: string,
    imageUrl: string = ""
  ): Promise<ChatMessage> => {
    if (!socket) throw new Error("Socket not initialized");
    const payload = {
      text: text.trim(),
      images: imageUrl ? [imageUrl] : [],
    };

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
        };

        resolve(msg);
      });
    });
  };

  return {
    connectSocket,
    disconnectSocket,
    reconnectSocket,
    sendMessage,
    isConnected: () => Boolean(socket?.connected),
    getSocketId: () => socket?.id ?? null,
    setConnectionStateHandler,
  };
};

export type ChatService = ReturnType<typeof createChatService>;
