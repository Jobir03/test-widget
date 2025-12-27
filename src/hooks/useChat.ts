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
  LoadingEvent,
  LoadingType,
} from "../services/chat/types";

export function useChat(apiBase: string, socketUrl: string, widgetKey: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chatService = useRef<ReturnType<typeof createChatService> | null>(null);
  const apiRef = useRef<ReturnType<typeof createApiClient> | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const loadingRef = useRef<boolean>(false);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [quickReplyOptions, setQuickReplyOptions] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [loadingStates, setLoadingStates] = useState<
    Record<LoadingType, boolean>
  >({
    schedule: false,
    callRequest: false,
    image: false,
    ai: false,
    roomGeneration: false,
    processing: false,
  });

  const isOnline = () =>
    typeof navigator !== "undefined" ? navigator.onLine : true;

  /** Transform API message to internal message */
  const mapServerMessage = (m: ServerMessage): ChatMessage => ({
    id: m.id,
    from: m.isAdmin ? "bot" : "user",
    text: m.text, // Legacy support
    question: m.question ?? null, // New field
    information: m.information ?? null, // New field
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
    description: m.description ?? null, // Legacy support
    options: m.options ?? [],
    schedule: m.schedule ?? null,
    callRequest: m.callRequest ?? null,
    product_photo_link: m.product_photo_link ?? null,
    generated_photo: m.generated_photo ?? null,
    room_image_link: m.room_image_link ?? null,
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

  /** Upload file helper */
  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      if (!apiRef.current) {
        apiRef.current = createApiClient(apiBase, widgetKey);
      }
      const formData = new FormData();
      formData.append("file", file);

      try {
        const client = apiRef.current as any;
        const response = await client.post("/upload/widget-user", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        const url = response.url || response.data?.url;
        return `https://storage.googleapis.com${url}`;
      } catch (error) {
        console.error("File upload failed:", error);
        throw error;
      }
    },
    [apiBase, widgetKey]
  );

  /** Handle loading events from socket */
  const onLoadingEvent = useCallback(
    (event: LoadingEvent) => {
      if (!event || !event.type) return;

      // For 'processing' type loading events
      if (event.type === "processing") {
        // Clear timeout since processing type came
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = null;
        }

        setLoadingStates((prev) => ({
          ...prev,
          processing: event.loading,
        }));

        // If processing is false, check if we should stop loading
        if (!event.loading) {
          // Check if there are messages waiting for TTS
          const hasWaitingMessages = messagesRef.current.some(
            (msg) => msg.waitingForTTS === true
          );

          // If no messages waiting for TTS, stop loading
          if (!hasWaitingMessages) {
            setLoadingStates((prev) => ({
              ...prev,
              ai: false,
              processing: false,
            }));
            setIsTyping(false);
            setLoading(false);
          }
        }
        return;
      }

      // For 'ai' type loading events, intelligently handle based on current state
      if (event.type === "ai" && !event.loading) {
        // Server is saying "stop loading" (ai: false)
        // BUT we should ignore this if:
        // 1. We're currently loading (user just sent a message)
        // 2. There are messages waiting for TTS
        // 3. Processing is still active





        // Only stop loading if we're not currently loading and no messages waiting and not processing
        setLoadingStates((prev) => ({
          ...prev,
          ai: false,
        }));
        setIsTyping(false);
        setLoading(false);
      } else if (event.type === "ai" && event.loading) {
        // Loading is becoming true, set it normally
        setLoadingStates((prev) => ({
          ...prev,
          ai: true,
        }));
        setIsTyping(true);
        setLoading(true);

        // Clear any existing timeout
        if (processingTimeoutRef.current) {
          clearTimeout(processingTimeoutRef.current);
          processingTimeoutRef.current = null;
        }

        // If processing type doesn't come within 3 seconds, stop loading
        // REMOVED: User requested to keep loading until explicitly turned off
        /*
        processingTimeoutRef.current = setTimeout(() => {
          const isProcessing = loadingStates.processing;

          // Only stop if not processing
          if (!isProcessing) {
            console.log(
              "[Loading] Processing type not received, stopping loading"
            );
            setLoadingStates((prev) => ({
              ...prev,
              ai: false,
              processing: false,
            }));
            setIsTyping(false);
            setLoading(false);
          }
          processingTimeoutRef.current = null;
        }, 3000);
        */
      } else {
        // For other loading types, update normally
        setLoadingStates((prev) => ({
          ...prev,
          [event.type]: event.loading,
        }));
      }
    },
    [loadingStates.processing]
  );

  // Update messages ref whenever messages change
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Update loading ref whenever loading state changes
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  // Keep typing animation active if there are messages waiting for TTS
  // This is no longer strictly needed for blocking display, but we can keep it clean
  useEffect(() => {
    // No-op or remove if not needed.
    // Since we removed waitingForTTS logic for display, this effect is largely redundant
    // for keeping ai loading state true.
  }, [messages]);

  /** Reveal message after TTS completes */
  const revealMessageAfterTTS = useCallback((messageId: string) => {
    setMessages((prev) => {
      const updated = prev.map((msg) =>
        msg.id === messageId ? { ...msg, waitingForTTS: false } : msg
      );

      // Check if there are any other messages still waiting for TTS
      const hasOtherWaitingMessages = updated.some(
        (msg) => msg.waitingForTTS === true
      );

      // Only stop loading/typing if no other messages are waiting
      if (!hasOtherWaitingMessages) {
        setLoading(false);
        setIsTyping(false);
        setLoadingStates((prevState) => ({
          ...prevState,
          ai: false,
        }));
      }

      return updated;
    });
  }, []);

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

    // Check if we have a pending message that matches this new message
    // We match by text content (or question) and being from user
    const msgContent = msg.text || msg.question;

    if (msg.from === "user") {
      setMessages((prev) => {
        const pendingIndex = prev.findIndex(
          (m) =>
            m.isPending &&
            m.from === "user" &&
            // Case A: Text matches (and both might have images or not, primary key is text)
            ((msgContent &&
              (m.text === msgContent || m.question === msgContent)) ||
              // Case B: Both have NO text, but both HAVE images (assuming serial upload of images)
              (!msgContent &&
                !m.text &&
                !m.question &&
                m.images.length > 0 &&
                msg.images.length > 0))
        );

        if (pendingIndex !== -1) {
          // Replace pending message with real message
          const newMessages = [...prev];
          const pendingMsg = prev[pendingIndex];

          // CRITICAL: Ensure the message doesn't jump up the list if server time is behind
          // If the pending message has a later timestamp (which we forced to be at bottom),
          // keep that timestamp for the confirmed message.
          const pendingTime = new Date(pendingMsg.timestamp).getTime();
          const serverTime = new Date(msg.timestamp).getTime();

          if (serverTime < pendingTime) {
            msg.timestamp = pendingMsg.timestamp;
          }

          newMessages[pendingIndex] = msg;
          return newMessages;
        }

        // If no pending message found, just append
        // Check for duplicates just in case (by ID)
        if (prev.some((m) => m.id === msg.id)) {
          return prev;
        }
        return [...prev, msg];
      });
      setIsUploading(false);
    } else {
      // For bot messages, mark as waitingForTTS if it has text to speak
      const hasTextToSpeak = Boolean(
        msg.information || msg.question || msg.text
      );

      setMessages((prev) => {
        // Check for duplicates by ID
        if (prev.some((m) => m.id === msg.id)) {
          return prev;
        }
        // Mark bot messages with typing effect, but show immediately (waitingForTTS: false)
        const newMessage = {
          ...msg,
          // CRITICAL: Always show immediately, never wait for TTS
          waitingForTTS: false,
          // CRITICAL: Always use typing effect for text content
          isTypingEffect: hasTextToSpeak && !msg.isError,
        };

        const updatedMessages = [...prev, newMessage];

        // Update ref immediately to ensure onLoadingEvent can see the new message
        messagesRef.current = updatedMessages;

        return updatedMessages;
      });

      // Stop generic loading/typing indicators immediately as the message is now visible (and will type itself)
      if (hasTextToSpeak && !msg.isError) {
        setLoading(false);
        setIsTyping(false);
        setLoadingStates((prev) => ({ ...prev, ai: false }));
      }

      if (!hasTextToSpeak || msg.isError) {
        setLoading(false);
        setIsTyping(false);
        setIsUploading(false);
      } else {
        setIsUploading(false);
      }
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
      chatService.current
        .connectSocket(socketUrl, onNewMessage, onLoadingEvent)
        .catch(() => {
          setError("Connection error");
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
        await chatService.current.connectSocket(
          socketUrl,
          onNewMessage,
          onLoadingEvent
        );
        await fetchMessages();
        setError(null);
      } catch (error) {
        console.error("Failed to reconnect after coming online:", error);
        // If reconnect fails with auth error (401), refresh token will be called automatically
        // by apiClient interceptor or socket error handler, which will then call authenticate if needed
        setError("Reconnection error");
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
    callRequest?: CallRequestPayload | null,
    file?: File | null
  ) => {
    if (
      !chatService.current ||
      (!text.trim() && !imageUrl && !schedule && !callRequest && !file)
    )
      return;

    // Optimistic UI update
    let tempId = "";

    if ((text || file) && !schedule && !callRequest) {
      tempId = `temp-${Date.now()}`;

      // Ensure the pending message appears at the bottom even if server time is ahead of client time
      const lastMessage = messages[messages.length - 1];
      let messageTime = new Date();
      if (
        lastMessage &&
        new Date(lastMessage.timestamp).getTime() > messageTime.getTime()
      ) {
        messageTime = new Date(new Date(lastMessage.timestamp).getTime() + 1);
      }

      const pendingMessage: ChatMessage = {
        id: tempId,
        from: "user",
        text: text,
        images: [],
        products: [],
        timestamp: messageTime,
        isPending: true,
      };
      setMessages((prev) => [...prev, pendingMessage]);
    }

    setLoading(true);
    setError(null);
    setIsTyping(true);
    if (file) setIsUploading(true);

    try {
      let finalImageUrl = imageUrl;
      if (file) {
        finalImageUrl = await uploadFile(file);
      }

      await chatService.current.sendMessage(
        text,
        finalImageUrl,
        schedule,
        callRequest
      );
    } catch {
      setError("Failed to send message");
      setMessages((prev) => {
        // Remove the pending message if it exists
        if (tempId) {
          const filtered = prev.filter((m) => m.id !== tempId);
          // Add error message
          return [
            ...filtered,
            {
              id: Date.now().toString(),
              from: "bot",
              text: "Sorry, something went wrong. Please try again.",
              images: [],
              products: [],
              timestamp: new Date(),
            },
          ];
        }

        return [
          ...prev,
          {
            id: Date.now().toString(),
            from: "bot",
            text: "Sorry, something went wrong. Please try again.",
            images: [],
            products: [],
            timestamp: new Date(),
          },
        ];
      });
      // On error, stop loading immediately since there won't be a TTS response
      setLoading(false);
      setIsUploading(false);
      setIsTyping(false);
    }
    // Don't stop loading in finally - let it continue until TTS completes
    // The loading state will be stopped by revealMessageAfterTTS or onNewMessage
    // Only stop uploading state since file upload is complete
    setIsUploading(false);
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
    loadingStates,
    revealMessageAfterTTS,
  };
}
