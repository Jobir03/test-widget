import { useState, useEffect, useCallback, useRef } from "react";
import { createChatService } from "../services/chat/chatService";
import { authService } from "../services/chat/auth";
import { createApiClient } from "../services/api/apiClient";
import type {
  ChatMessage,
  ServerMessage,
  PaginatedResponse,
  SchedulePayload,
  CallRequestPayload,
  Product,
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
  const [isUploading, setIsUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

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
    description: m.description ?? null,
    options: m.options ?? [],
    schedule: m.schedule ?? null,
    callRequest: m.callRequest ?? null,
  });

  /** Fetch message history (paginated) */
  const fetchMessages = useCallback(async () => {
    setFetching(true);
    setError(null);
    setCurrentPage(1);
    setHasMore(true);

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

      const response = await apiRef.current.get<
        | PaginatedResponse<ServerMessage>
        | {
            data: ServerMessage[];
            total?: number;
            page?: number;
            totalPages?: number;
            meta?: {
              total: number;
              perPage: number;
              currentPage: number;
              totalPages: number;
            };
          }
      >("/messages", { params: { page: 1, limit: 30 } });

      // Handle both response formats
      if (
        !response ||
        (typeof response === "object" && !("data" in response))
      ) {
        throw new Error("Invalid response format");
      }

      const messagesData = Array.isArray(response.data) ? response.data : [];
      const formatted = messagesData.map(mapServerMessage);

      // Find the most recent bot message with options
      const botMessageWithOptions = formatted
        .filter(
          (msg) => msg.from === "bot" && msg.options && msg.options.length > 0
        )
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      setQuickReplyOptions(botMessageWithOptions?.options ?? []);
      setMessages(formatted);
      setError(null); // Clear any previous errors

      // Extract products from messages (newest first, find first message with products)
      // This handles reload case - search from newest to oldest
      const messageWithProducts = formatted
        .filter((msg) => msg.products && msg.products.length > 0)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      if (messageWithProducts && messageWithProducts.products) {
        setAvailableProducts(messageWithProducts.products);
      } else {
        // If no products found, clear the state
        setAvailableProducts([]);
      }

      // Check if there are more pages
      if ("meta" in response && response.meta) {
        setHasMore(response.meta.currentPage < response.meta.totalPages);
      } else if (
        "page" in response &&
        "totalPages" in response &&
        response.page !== undefined &&
        response.totalPages !== undefined
      ) {
        setHasMore(response.page < response.totalPages);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load messages";
      setMessages([]);
      setQuickReplyOptions([]);
      setError(errorMessage);
    } finally {
      setFetching(false);
    }
  }, [apiBase, widgetKey]);

  /** Load more messages (for infinity scroll) */
  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || fetchingMore || fetching || !isOnline()) return;

    setFetchingMore(true);
    try {
      if (!apiRef.current) {
        authService.setBaseUrl(apiBase);
        authService.setWidgetKey(widgetKey);
        apiRef.current = createApiClient(apiBase, widgetKey);
      }

      const nextPage = currentPage + 1;
      const response = await apiRef.current.get<
        | PaginatedResponse<ServerMessage>
        | {
            data: ServerMessage[];
            total?: number;
            page?: number;
            totalPages?: number;
            meta?: {
              total: number;
              perPage: number;
              currentPage: number;
              totalPages: number;
            };
          }
      >("/messages", { params: { page: nextPage, limit: 30 } });

      // Handle both response formats
      if (
        !response ||
        (typeof response === "object" && !("data" in response))
      ) {
        throw new Error("Invalid response format");
      }

      const messagesData = Array.isArray(response.data) ? response.data : [];
      const formatted = messagesData.map(mapServerMessage);

      setMessages((prev) => [...formatted, ...prev]);
      setCurrentPage(nextPage);

      // Check if there are more pages
      if ("meta" in response && response.meta) {
        setHasMore(response.meta.currentPage < response.meta.totalPages);
      } else if (
        "page" in response &&
        "totalPages" in response &&
        response.page !== undefined &&
        response.totalPages !== undefined
      ) {
        setHasMore(response.page < response.totalPages);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Load more error:", err);
    } finally {
      setFetchingMore(false);
    }
  }, [apiBase, widgetKey, currentPage, hasMore, fetchingMore, fetching]);

  /** Handle new incoming message */
  const onNewMessage = useCallback((msg: ChatMessage) => {
    if (!msg) return;

    // Update quick reply options if message has options and is from bot
    // Support both "single_choice" and "input" types (or any type with options)
    if (msg.from === "bot" && msg.options && msg.options.length > 0) {
      setQuickReplyOptions(msg.options);
    } else if (
      msg.from === "bot" &&
      (!msg.options || msg.options.length === 0)
    ) {
      // Clear options if bot message has no options
      setQuickReplyOptions([]);
    }

    // Update products if message has products (from socket)
    // Always update to the latest products from socket
    if (msg.products && msg.products.length > 0) {
      setAvailableProducts(msg.products);
    }

    setMessages((prev) => [...prev, msg]);
    setLoading(false);
    // Stop typing animation for bot messages (including error messages) or scheduled messages
    if (msg.from === "bot" || msg.isAdmin || (!msg.isAdmin && msg.schedule)) {
      setIsTyping(false);
      setIsUploading(false);
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
    schedule?: SchedulePayload | null,
    callRequest?: CallRequestPayload | null
  ) => {
    if (!chatService.current || (!text.trim() && !imageUrl && !schedule && !callRequest))
      return;
    setLoading(true);
    setError(null);
    setIsTyping(true);

    try {
      await chatService.current.sendMessage(text, imageUrl, schedule, callRequest);
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

  const sendHomeGeneration = async (
    homeImageUrl: string,
    productImageUrl: string,
    prompt: string = ""
  ) => {
    if (!chatService.current) return;

    try {
      setIsTyping(true);
      await chatService.current.sendHomeGeneration(
        homeImageUrl,
        productImageUrl,
        prompt
      );
      // Typing animation bot javob kutayotganda ko'rsatiladi
      // Bot javob kelganda onNewMessage orqali setIsTyping(false) qilinadi
    } catch (error) {
      console.error("Failed to send home generation:", error);
      setIsTyping(false);
      throw error;
    }
  };

  return {
    messages,
    quickReplyOptions,
    sendMessage,
    sendHomeGeneration,
    loading,
    fetching,
    error,
    isTyping,
    isUploading,
    setIsUploading,
    loadMoreMessages,
    hasMore,
    fetchingMore,
    availableProducts,
  };
}
