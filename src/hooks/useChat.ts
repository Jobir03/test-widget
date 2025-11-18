import { useState, useEffect, useCallback, useRef } from "react";
import { createChatService } from "../services/chat/chatService";
import { authService } from "../services/chat/auth";
import { createApiClient } from "../services/api/apiClient";
import type {
  ChatMessage,
  ServerMessage,
  PaginatedResponse,
  SchedulePayload,
} from "../services/chat/types";

export function useChat(apiBase: string, socketUrl: string, widgetKey: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chatService = useRef<ReturnType<typeof createChatService> | null>(null);
  const apiRef = useRef<ReturnType<typeof createApiClient> | null>(null);
  const [quickReplyOptions, setQuickReplyOptions] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const isOnline = () =>
    typeof navigator !== "undefined" ? navigator.onLine : true;

  /** Transform API message to internal message */
  const mapServerMessage = (m: ServerMessage): ChatMessage => ({
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
    type: m.type,
    options: m.options ?? [],
    schedule: m.schedule ?? null,
  });

  /** Fetch message history (paginated) */
  const fetchMessages = useCallback(async () => {
    setFetching(true);
    setError(null);

    if (!isOnline()) {
      setFetching(false);
      return;
    }

    try {
      if (!apiRef.current) {
        authService.setBaseUrl(apiBase);
        authService.setWidgetKey(widgetKey);
        apiRef.current = createApiClient(apiBase, widgetKey);
      }

      const data: PaginatedResponse<ServerMessage> = await apiRef.current.get(
        "/messages",
        { params: { page: 1, limit: 100 } }
      );
      const formatted = data.data.map(mapServerMessage);
      const firstChoiceMessage = formatted.find((msg) => msg.from === "bot");
      setQuickReplyOptions(firstChoiceMessage?.options ?? []);
      setMessages(formatted);
    } catch (err) {
      console.error("Fetch error:", err);
      setMessages([]);
      setQuickReplyOptions([]);
      setError("Failed to load messages");
    } finally {
      setFetching(false);
    }
  }, [apiBase, widgetKey]);

  /** Handle new incoming message */
  const onNewMessage = useCallback((msg: ChatMessage) => {
    if (!msg) return;
    if (msg.type === "single_choice") {
      setQuickReplyOptions(msg.options ?? []);
    }
    setMessages((prev) => [...prev, msg]);
    setLoading(false);
    if (msg.isAdmin || (!msg.isAdmin && msg.schedule)) {
      setIsTyping(false);
    }
  }, []);

  useEffect(() => {
    if (!widgetKey) return;

    if (!isOnline()) {
      setFetching(false);
      return;
    }

    authService.setBaseUrl(apiBase);
    authService.setWidgetKey(widgetKey);

    chatService.current = createChatService(widgetKey);
    fetchMessages();

    if (socketUrl) {
      chatService.current.connectSocket(socketUrl, onNewMessage).catch(() => {
        setError("Aloqa o'rnatishda xatolik");
      });
    }

    return () => chatService.current?.disconnectSocket();
  }, [apiBase, fetchMessages, onNewMessage, socketUrl, widgetKey]);

  useEffect(() => {
    const handleOffline = () => {
      chatService.current?.disconnectSocket();
    };

    window.addEventListener("offline", handleOffline);
    return () => window.removeEventListener("offline", handleOffline);
  }, []);

  /** Handle online/offline events to reconnect when coming back online */
  useEffect(() => {
    const handleOnline = async () => {
      if (!widgetKey || !socketUrl) return;

      try {
        console.log(" Internet restored, reconnecting...");

        // Ensure chat service exists
        if (!chatService.current) {
          chatService.current = createChatService(widgetKey);
        }

        // Reconnect socket and fetch messages
        // If token is invalid, we'll get 401 error and refresh token will be called automatically
        await chatService.current.connectSocket(socketUrl, onNewMessage);
        await fetchMessages();
        setError(null);
      } catch (error) {
        console.error("Failed to reconnect after coming online:", error);
        // If reconnect fails with auth error (401), refresh token will be called automatically
        // by apiClient interceptor or socket error handler, which will then call authenticate if needed
        setError("Qayta ulanishda xatolik");
      }
    };

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [widgetKey, socketUrl, fetchMessages, onNewMessage]);

  const sendMessage = async (
    text: string,
    imageUrl: string = "",
    schedule?: SchedulePayload | null
  ) => {
    if (!chatService.current || (!text.trim() && !imageUrl && !schedule))
      return;
    setLoading(true);
    setError(null);
    setIsTyping(true);

    try {
      await chatService.current.sendMessage(text, imageUrl, schedule);
    } catch {
      setError("Failed to send message");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          from: "bot",
          text: "Sorry, something went wrong. Please try again.",
          images: [],
          products: [],
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return {
    messages,
    quickReplyOptions,
    sendMessage,
    loading,
    fetching,
    error,
    isTyping,
  };
}
