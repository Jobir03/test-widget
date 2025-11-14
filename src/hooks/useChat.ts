import { useState, useEffect, useCallback, useRef } from "react";
import { createChatService } from "../services/chat/chatService";
import { authService } from "../services/chat/auth";
import { createApiClient } from "../services/api/apiClient";
import type {
  ChatMessage,
  ServerMessage,
  PaginatedResponse,
} from "../services/chat/types";

// No initial seeded messages; UI will render an empty state

export function useChat(apiBase: string, socketUrl: string, widgetKey: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chatService = useRef<ReturnType<typeof createChatService> | null>(null);
  const apiRef = useRef<ReturnType<typeof createApiClient> | null>(null);

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
  });

  /** Fetch message history (paginated) */
  const fetchMessages = useCallback(async () => {
    setFetching(true);
    setError(null);

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
      setMessages(formatted);
    } catch (err) {
      console.error("Fetch error:", err);
      setMessages([]);
      setError("Failed to load messages");
    } finally {
      setFetching(false);
    }
  }, [apiBase, widgetKey]);

  /** Handle new incoming message */
  const onNewMessage = useCallback((msg: ChatMessage) => {
    if (!msg) return;
    setMessages((prev) => [...prev, msg]);
    setLoading(false);
  }, []);

  /** Initialize socket + fetch history */
  useEffect(() => {
    if (!widgetKey) return;

    // Set auth configuration only once
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

  /** Send message */
  const sendMessage = async (text: string, imageUrl: string = "") => {
    if (!chatService.current || (!text.trim() && !imageUrl)) return;
    setLoading(true);
    setError(null);

    try {
      await chatService.current.sendMessage(text, imageUrl);
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

  return { messages, sendMessage, loading, fetching, error };
}
