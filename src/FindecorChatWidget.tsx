import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Calendar,
  Maximize2,
  MessageCircle,
  Minimize2,
  Paperclip,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { useChat } from "./hooks/useChat";
import { createApiClient, type ApiClient } from "./services/api/apiClient";
import ChatMessages from "./components/ChatMessages";
import authService from "./services/chat/auth";
import type { FindecorChatWidgetProps } from "./types/FindecorChatWidget.types";

const FindecorChatWidget: React.FC<FindecorChatWidgetProps> = ({
  apiBase,
  socketUrl,
  widgetKey,
  userId: _userId,
  color,
  textColor,
  widgetSize,
  position,
  borderRadius,
  companyName: _companyName,
  autoOpen,
  headerText,
  offlineMessage,
  inputPlaceholder,
}) => {
  void _userId;
  void _companyName;
  const {
    messages,
    quickReplyOptions,
    sendMessage,
    loading,
    fetching,
    error,
    isTyping,
    loadMoreMessages,
    hasMore,
    fetchingMore,
    availableProducts,
  } = useChat(apiBase, socketUrl, widgetKey);

  const [open, setOpen] = useState(autoOpen);
  const [fullscreen, setFullscreen] = useState(false);
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ApiClient | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    authService.setBaseUrl(apiBase);
  }, [apiBase]);

  useEffect(() => {
    if (widgetRef.current) {
      const root =
        widgetRef.current.closest("#findecor-chat-root") ||
        document.documentElement;
      (root as HTMLElement).style.setProperty("--fcw-accent", color);
      (root as HTMLElement).style.setProperty(
        "--fcw-accent-contrast",
        textColor
      );
      (root as HTMLElement).style.setProperty(
        "--fcw-border-radius",
        borderRadius
      );
    }
  }, [color, textColor, borderRadius]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const positionClass = useMemo(() => `pos-${position}` as const, [position]);

  const sizeClass = useMemo(() => `size-${widgetSize}` as const, [widgetSize]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        if (!apiRef.current) {
          apiRef.current = createApiClient(apiBase, widgetKey);
        }
        const client = apiRef.current! as ApiClient;
        const response = await client.post<{ url: string }>(
          "/upload/widget-user",
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
        return `https://storage.googleapis.com${response.url}`;
      } catch (error) {
        console.error("File upload failed:", error);
        throw error;
      }
    },
    [apiBase, widgetKey]
  );

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || loading || isUploading || !isOnline)
      return;
    let imageUrl = "";
    try {
      if (selectedFile) {
        setIsUploading(true);
        imageUrl = await uploadFile(selectedFile);
      }
      sendMessage(input, imageUrl);
      setInput("");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (!messages.length) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.schedule) {
      setShowScheduleForm(false);
    }
  }, [messages]);

  useEffect(() => {
    if (open && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      // Only auto-scroll to bottom if user is near the bottom (within 100px)
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        100;
      if (isNearBottom || messages.length <= 30) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages, open]);

  // Infinity scroll handler
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !open) return;

    const handleScroll = () => {
      // Load more when scrolled to top (within 50px)
      if (container.scrollTop < 50 && hasMore && !fetchingMore && !fetching) {
        const previousScrollHeight = container.scrollHeight;
        const previousScrollTop = container.scrollTop;

        loadMoreMessages().then(() => {
          // Preserve scroll position after loading more messages
          requestAnimationFrame(() => {
            if (container) {
              const newScrollHeight = container.scrollHeight;
              const scrollDifference = newScrollHeight - previousScrollHeight;
              container.scrollTop = previousScrollTop + scrollDifference;
            }
          });
        });
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [open, hasMore, fetchingMore, fetching, loadMoreMessages]);

  return (
    <div ref={widgetRef}>
      {!open && (
        <button
          className={`fcw fcw-launcher ${positionClass}`}
          onClick={() => setOpen(true)}
          aria-label="Chat"
        >
          <MessageCircle size={26} />
        </button>
      )}

      {open && (
        <div
          className={`fcw fcw-container ${positionClass} ${sizeClass} ${
            fullscreen ? "fullscreen" : ""
          }`}
          style={{
            ...(fullscreen ? {} : { borderRadius }),
          }}
        >
          <div className="fcw-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div className="fcw-message-icon">
                <MessageCircle size={22} />
              </div>
              <div className="fcw-title">
                <h2>{headerText}</h2>
                <span>{isOnline ? "Online" : "Offline"}</span>
              </div>
            </div>
            <div className="fcw-actions">
              <button
                onClick={() => setFullscreen((v) => !v)}
                title="Toggle fullscreen"
              >
                {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button onClick={() => setOpen(false)} title="Close">
                <X size={20} />
              </button>
            </div>
          </div>

          {!isOnline && (
            <div
              className="fcw fcw-quick-replies"
              role="alert"
              style={{
                backgroundColor: "#fff3cd",
                color: "#856404",
                fontSize: "14px",
                padding: "12px 16px",
                borderBottom: "1px solid #ffc107",
              }}
            >
              {offlineMessage}
            </div>
          )}
          {error && isOnline && (
            <div
              className="fcw fcw-quick-replies"
              role="alert"
              style={{
                backgroundColor: "#f8d7da",
                color: "#721c24",
                padding: "12px 16px",
                borderBottom: "1px solid #f5c6cb",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <span style={{ flex: 1 }}>{error}</span>
              <button
                onClick={() => window.location.reload()}
                style={{
                  backgroundColor: "#dc3545",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  padding: "6px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
                title="Reload page"
              >
                <RefreshCw size={16} />
                Reload
              </button>
            </div>
          )}
          <div ref={messagesContainerRef} className="fcw fcw-messages">
            {fetchingMore && (
              <div
                className="fcw fcw-loading-more"
                style={{
                  textAlign: "center",
                  padding: "12px",
                  color: "#666",
                  fontSize: "14px",
                }}
              >
                Loading more messages...
              </div>
            )}
            <ChatMessages
              messages={messages}
              fetching={fetching}
              sendMessage={sendMessage}
              showScheduleForm={showScheduleForm}
              onCloseSchedule={() => setShowScheduleForm(false)}
              widgetKey={widgetKey}
              products={availableProducts}
            />
            {isTyping && (
              <div className="fcw fcw-typing-row">
                <div className="fcw fcw-bubble bot fcw-typing-bubble">
                  <span className="fcw fcw-typing">
                    <span className="fcw-typing-dot" />
                    <span className="fcw-typing-dot" />
                    <span className="fcw-typing-dot" />
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="fcw fcw-quick-replies">
            {quickReplyOptions.length > 0 && (
              <div className="fcw-chips-container">
                {quickReplyOptions.map((label) => (
                  <button
                    key={label}
                    className="fcw fcw-chip"
                    onClick={() => {
                      if (!isOnline || loading || isUploading) return;
                      sendMessage(label, "");
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button
              className="schedule-visit"
              onClick={() => setShowScheduleForm(true)}
            >
              <Calendar size={16} />
              Schedule Visit
            </button>
          </div>
          <div className="fcw fcw-input">
            {selectedFile && (
              <div className="fcw sellect-file">
                <span>{selectedFile.name}</span>
                <button onClick={removeFile} className="fcw-remove-file-btn">
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="fcw-input-container">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="fcw-file-input-hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`fcw-file-upload-label${
                  !isOnline || loading || isUploading ? " disabled" : ""
                }`}
              >
                <Paperclip size={20} />
              </label>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={inputPlaceholder}
                disabled={loading || isUploading || !isOnline}
              />
              <button
                onClick={handleSend}
                disabled={
                  !isOnline ||
                  ((loading || isUploading) && !input.trim() && !selectedFile)
                }
              >
                {loading || isUploading ? "..." : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindecorChatWidget;
