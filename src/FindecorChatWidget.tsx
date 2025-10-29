import { useState, useRef, useEffect, useCallback } from "react";
import {
  Calendar,
  Maximize2,
  MessageCircle,
  Minimize2,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { useChat } from "./hooks/useChat";
import { createApiClient, type ApiClient } from "./services/api/apiClient";
import { ProductRecommendations } from "./components/ProductRecommendations/ProductRecommendations";
import ScheduleVisitForm from "./components/ScheduleVisitForm/ScheduleVisitForm";

interface FindecorChatWidgetProps {
  apiBase: string;
  socketUrl: string;
  widgetKey: string;
  themeColor?: string;
}

const FindecorChatWidget: React.FC<FindecorChatWidgetProps> = ({
  apiBase,
  socketUrl,
  widgetKey,
  themeColor,
}) => {
  const { messages, sendMessage, loading, fetching, error } = useChat(
    apiBase,
    socketUrl,
    widgetKey
  );

  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ApiClient | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);

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
        console.log("response", response);
        return `https://storage.googleapis.com${response.url}`;
      } catch (error) {
        console.error("File upload failed:", error);
        throw error;
      }
    },
    [apiBase, widgetKey]
  );

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || loading || isUploading) return;

    let imageUrl = "";

    try {
      if (selectedFile) {
        setIsUploading(true);
        imageUrl = await uploadFile(selectedFile);
      }
      setIsTyping(true);
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

  // Scroll to bottom on new messages and turn off typing when bot responds
  useEffect(() => {
    if (open && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
    if (isTyping) setIsTyping(false);
  }, [messages, open, isTyping]);

  const formatDate = (date: Date) =>
    `${String(date.getDate()).padStart(2, "0")}/${String(
      date.getMonth() + 1
    ).padStart(2, "0")}/${date.getFullYear()}`;

  // const handleProductRedirect = (url: string) => {
  //   const iframe = document.getElementById("productFrame") as HTMLIFrameElement;
  //   if (iframe) {
  //     iframe.src = url;
  //   }
  // };

  return (
    <>
      <button
        className="fcw fcw-launcher"
        onClick={() => setOpen((p) => !p)}
        aria-label="Chat"
      >
        <MessageCircle size={26} />
      </button>

      {open && (
        <div
          className={`fcw fcw-container ${fullscreen ? "fullscreen" : ""}`}
          style={{
            // theme via CSS variable
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            "--fcw-accent": themeColor,
          }}
        >
          <div className="fcw-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div className="fcw-message-icon">
                <MessageCircle size={22} />
              </div>
              <div className="fcw-title">
                <h2>Sales Assistant</h2>
                <span>Online</span>
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

          {error && (
            <div
              className="fcw fcw-quick-replies"
              role="alert"
              style={{ color: "#c33" }}
            >
              {error}
            </div>
          )}
          <div ref={messagesContainerRef} className="fcw fcw-messages">
            {fetching ? (
              <div className="fcw fcw-empty">Loading messages…</div>
            ) : (
              (() => {
                const groupedMessages: Record<string, typeof messages> = {};
                messages.forEach((msg) => {
                  const d = new Date(msg.timestamp);
                  const dateKey = formatDate(d);
                  if (!groupedMessages[dateKey]) groupedMessages[dateKey] = [];
                  groupedMessages[dateKey].push(msg);
                });
                const sortedDates = Object.keys(groupedMessages).sort(
                  (a, b) => {
                    const [da, ma, ya] = a.split("/").map(Number);
                    const [db, mb, yb] = b.split("/").map(Number);
                    return (
                      new Date(ya, ma - 1, da).getTime() -
                      new Date(yb, mb - 1, db).getTime()
                    );
                  }
                );

                return sortedDates.map((date) => {
                  const msgs = groupedMessages[date].sort(
                    (a, b) =>
                      new Date(a.timestamp).getTime() -
                      new Date(b.timestamp).getTime()
                  );

                  return (
                    <div key={date} style={{ width: "100%" }}>
                      <div
                        style={{
                          textAlign: "center",
                          fontSize: "12px",
                          color: "#666",
                          margin: "12px 0",
                        }}
                      >
                        {date}
                      </div>
                      {msgs.map((msg) => (
                        <div key={msg.id} className="fcw fcw-message">
                          {msg?.text && (
                            <div
                              className={`fcw fcw-bubble ${
                                msg.from === "user" ? "user" : "bot"
                              }`}
                            >
                              {msg.text}
                              <span className="fcw fcw-time">
                                {new Date(msg.timestamp).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </span>
                            </div>
                          )}
                          {msg?.images && msg.images.length > 0 && (
                            <div
                              className={`fcw fcw-bubble ${
                                msg.from === "user" ? "user" : "bot"
                              }`}
                            >
                              <div
                                style={{
                                  marginTop: "8px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "4px",
                                }}
                              >
                                {msg.images.map((img, idx) => (
                                  <img
                                    key={idx}
                                    src={img}
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                    alt={`Attachment ${idx + 1}`}
                                    style={{
                                      maxWidth: "100%",
                                      maxHeight: "200px",
                                      borderRadius: "8px",
                                      objectFit: "cover",
                                    }}
                                  />
                                ))}
                              </div>
                              <span className="fcw fcw-time">
                                {new Date(msg.timestamp).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </span>
                            </div>
                          )}

                          {msg?.products && msg.products.length > 0 && (
                            <div
                              style={{
                                width: "100%",
                              }}
                              className={`fcw fcw-bubble ${
                                msg.from === "user" ? "user" : "bot"
                              }`}
                            >
                              <ProductRecommendations
                                products={msg.products}
                                onProductClick={(product) => {
                                  sendMessage(product.name);
                                }}
                              />

                              <span className="fcw fcw-time">
                                {new Date(msg.timestamp).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                      {showScheduleForm && <ScheduleVisitForm />}
                    </div>
                  );
                });
              })()
            )}
            {isTyping && (
              <div className="fcw fcw-bubble bot">
                <span className="fcw fcw-typing">
                  <span className="fcw-typing-dot" />
                  <span className="fcw-typing-dot" />
                  <span className="fcw-typing-dot" />
                </span>
              </div>
            )}
          </div>
          <div className="fcw fcw-quick-replies">
            <button
              className="schedule-visit"
              onClick={() => setShowScheduleForm(true)}
            >
              <Calendar size={16} />
              Schedule Visit
            </button>
            <div className="fcw-chips-container">
              {["Show me laptops", "I need a phone", "What's on sale?"].map(
                (label) => (
                  <button
                    key={label}
                    className="fcw fcw-chip"
                    onClick={() => setInput(label)}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>
          <div className="fcw fcw-input">
            {selectedFile && (
              <div className="fcw sellect-file">
                <span>{selectedFile.name}</span>
                <button
                  onClick={removeFile}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#6b7280",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
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
                style={{ display: "none" }}
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                style={{
                  cursor: "pointer",
                  padding: "8px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "8px",
                  color: themeColor,
                }}
              >
                <Paperclip size={20} />
              </label>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type your message..."
                disabled={loading || isUploading}
                style={{
                  flex: 1,
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  fontSize: "14px",
                  background: loading || isUploading ? "#f5f5f5" : "#fff",
                }}
              />
              <button
                onClick={handleSend}
                disabled={
                  (loading || isUploading) && !input.trim() && !selectedFile
                }
                style={{
                  background:
                    (loading || isUploading) && !input.trim() && !selectedFile
                      ? "#ccc"
                      : themeColor,
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px",
                  marginLeft: "8px",
                  fontWeight: 600,
                  cursor:
                    (loading || isUploading) && !input.trim() && !selectedFile
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {loading || isUploading ? "..." : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FindecorChatWidget;
