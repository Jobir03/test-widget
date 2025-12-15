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
  Mic,
  MicOff,
} from "lucide-react";
import { useChat } from "./hooks/useChat";
import { createApiClient, type ApiClient } from "./services/api/apiClient";
import ChatMessages from "./components/ChatMessages";
import VoiceTalkPanel, {
  type VoiceTalkPanelRef,
} from "./components/VoiceTalkPanel/VoiceTalkPanel";
import authService from "./services/chat/auth";
import type { FindecorChatWidgetProps } from "./types/FindecorChatWidget.types";
import avatarImage from "./assets/images/chat-avatar.jpg";

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
    loadingStates,
  } = useChat(apiBase, socketUrl, widgetKey);

  const [open, setOpen] = useState(autoOpen);
  const [fullscreen, setFullscreen] = useState(false);
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const apiRef = useRef<ApiClient | null>(null);
  const voiceTalkPanelRef = useRef<VoiceTalkPanelRef | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showCallMeForm, setShowCallMeForm] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [companyAvatar, setCompanyAvatar] = useState<string | null>(
    "https://cdn-icons-png.flaticon.com/512/6858/6858504.png"
  );
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showMicIcon, setShowMicIcon] = useState(false);

  useEffect(() => {
    authService.setBaseUrl(apiBase);
  }, [apiBase]);

  useEffect(() => {
    // Check if widgetKey has changed and re-authenticate if needed
    if (widgetKey) {
      authService.setWidgetKey(widgetKey);
      // authenticate will check if key changed and re-auth if needed
      authService.authenticate(widgetKey).catch((error) => {
        console.error("Widget authentication error:", error);
      });

      // Load company avatar
      authService
        .getUser()
        .then((userData) => {
          if (userData?.widget?.company?.avatar) {
            setCompanyAvatar(userData.widget.company.avatar);
          }
        })
        .catch(() => {
          // Silently fail if user data can't be loaded
        });
    }
  }, [widgetKey]);

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

  const handleVoiceToggle = async () => {
    if (!voiceTalkPanelRef.current) return;

    if (voiceTalkPanelRef.current.isRecording) {
      voiceTalkPanelRef.current.stopRecording();
    } else {
      await voiceTalkPanelRef.current.startRecording();
    }
  };

  const [pendingMicAction, setPendingMicAction] = useState<"start" | "stop" | null>(null);

  const handleMicIconClick = async (e: React.MouseEvent) => {
    // Stop event propagation so card click doesn't trigger
    e.stopPropagation();

    // Toggle recording directly without opening the chat
    if (voiceTalkPanelRef.current) {
      if (voiceTalkPanelRef.current.isRecording) {
        voiceTalkPanelRef.current.stopRecording();
      } else {
        await voiceTalkPanelRef.current.startRecording();
      }
    }
  };

  // Handle pending mic action when chat opens
  useEffect(() => {
    if (open && pendingMicAction && voiceTalkPanelRef.current) {
      const action = pendingMicAction;
      setPendingMicAction(null);

      // Wait a bit for VoiceTalkPanel to fully mount
      setTimeout(async () => {
        if (voiceTalkPanelRef.current) {
          if (action === "start") {
            await voiceTalkPanelRef.current.startRecording();
          } else if (action === "stop") {
            voiceTalkPanelRef.current.stopRecording();
          }
        }
      }, 500);
    }
  }, [open, pendingMicAction]);

  const handleCloseViaDetails = () => {
    // Don't stop recording when closing via Details button
    // Just close the chat and show mic icon
    // Recording will continue in background
    setOpen(false);
    setShowMicIcon(true);
  };

  const handleNormalClose = () => {
    setOpen(false);
    setShowMicIcon(false);
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || loading || isUploading || !isOnline)
      return;
    let imageUrl = "";
    try {
      if (selectedFile) {
        setIsUploading(true);
        imageUrl = await uploadFile(selectedFile);
        // Trigger image upload event to refresh homeImageUrl in ProductRecommendations
        interface WindowWithHandler extends Window {
          __fcwImageUploadHandler?: () => void;
        }
        const handler = (window as WindowWithHandler).__fcwImageUploadHandler;
        if (handler) {
          handler();
        }
      }
      sendMessage(input, imageUrl);
      setInput("");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      // Keep focus on input after sending
      setTimeout(() => {
        if (textInputRef.current) {
          textInputRef.current.focus();
        }
      }, 0);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  useEffect(() => {
    if (!messages.length) return;
    const lastMessage = messages[messages.length - 1];

    // Handle schedule form display
    if (lastMessage.showScheduleForm === true) {
      setShowScheduleForm(true);
      // Scroll to bottom when schedule form should be shown
      if (messagesContainerRef.current) {
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop =
              messagesContainerRef.current.scrollHeight;
          }
        }, 100);
      }
    } else if (lastMessage.schedule) {
      // If schedule is confirmed, close the form
      setShowScheduleForm(false);
      // Scroll to bottom when schedule message arrives
      if (messagesContainerRef.current) {
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop =
              messagesContainerRef.current.scrollHeight;
          }
        }, 100);
      }
    }

    // Handle call request display
    if (lastMessage.callRequest) {
      setShowCallMeForm(false);
      // Scroll to bottom when call request message arrives
      if (messagesContainerRef.current) {
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop =
              messagesContainerRef.current.scrollHeight;
          }
        }, 100);
      }
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
        // Check if last message has images - if so, wait for images to load
        const lastMessage = messages[messages.length - 1];
        const hasImages = lastMessage?.images && lastMessage.images.length > 0;

        if (hasImages) {
          // For messages with images, wait longer for images to load
          // The onLoad handler in ChatMessages will handle scrolling after image loads
          return;
        }

        // Use setTimeout to ensure DOM is updated
        setTimeout(() => {
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        }, 50);
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

  // Track voice recording state (Removed Polling in favor of callback)
  /*
  useEffect(() => {
    const checkRecordingState = () => {
      if (voiceTalkPanelRef.current) {
        setIsVoiceRecording(voiceTalkPanelRef.current.isRecording);
      }
    };
    checkRecordingState();
    const interval = setInterval(checkRecordingState, 200);
    return () => clearInterval(interval);
  }, []);
  */

  return (
    <div ref={widgetRef} className="fcw-root">
      {!open && (
        <button
          className={`fcw fcw-launcher ${positionClass}`}
          onClick={() => {
            setOpen(true);
            setShowMicIcon(false);
          }}
          aria-label="Chat"
        >
          <div className="fcw-launcher-content">
            {companyAvatar && (
              <div className="fcw-launcher-avatar">
                <img src={avatarImage} alt="Company" />
              </div>
            )}
            <div className="fcw-launcher-text">
              <div className="fcw-launcher-title">Rug Advice in One Click</div>
              <div className="fcw-launcher-description">
                Upload your room photo and get personalized rug recommendations
                instantly.
              </div>
            </div>
            <div
              className="fcw-launcher-icon"
              onClick={showMicIcon ? handleMicIconClick : undefined}
              style={showMicIcon ? { cursor: 'pointer' } : {}}
            >
              {showMicIcon ? (
                isVoiceRecording ? (
                  <MicOff size={24} />
                ) : (
                  <Mic size={24} />
                )
              ) : (
                <MessageCircle size={24} />
              )}
            </div>
          </div>
        </button>
      )}

      {open && <div className="fcw-overlay" onClick={handleNormalClose} />}

      <div
        className={`fcw-dual-layout ${fullscreen ? "fullscreen" : ""} `}
        style={{
          borderRadius: borderRadius || undefined,
          display: "flex", // Always flex to maintain layout structure internally
          visibility: open ? "visible" : "hidden",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          position: "fixed", // Ensure it's fixed (should already be via CSS class, but forcing it for the hidden state to be safe)
          zIndex: open ? 10000 : -1, // Drop behind everything when closed
          // If it's closed, move it off-screen to be double sure it doesn't block interactions
          ...(open ? {} : { transform: 'scale(0.9)' })
        }}
      >
        <VoiceTalkPanel
          ref={voiceTalkPanelRef}
          apiBase={apiBase}
          widgetKey={widgetKey}
          sendMessage={sendMessage}
          messages={messages}
          onStateChange={setIsVoiceRecording}
        />
        <div className="fcw-widget-shell">
          <div className={`fcw fcw-container  ${sizeClass} `}>
            <div className="fcw-header">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
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
                  {fullscreen ? (
                    <Minimize2 size={18} />
                  ) : (
                    <Maximize2 size={18} />
                  )}
                </button>
                <button onClick={handleNormalClose} title="Close">
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
                sendHomeGeneration={sendHomeGeneration}
                showScheduleForm={showScheduleForm}
                onCloseSchedule={() => {
                  setShowScheduleForm(false);
                }}
                showCallMeForm={showCallMeForm}
                onCloseCallMe={() => {
                  setShowCallMeForm(false);
                }}
                widgetKey={widgetKey}
                isTyping={isTyping}
                isGeneratingImage={isGeneratingImage}
                onGeneratingImageChange={setIsGeneratingImage}
                loadingStates={loadingStates}
                onScrollToBottom={() => {
                  if (messagesContainerRef.current) {
                    messagesContainerRef.current.scrollTop =
                      messagesContainerRef.current.scrollHeight;
                  }
                }}
                onCloseChat={handleCloseViaDetails}
              />

              {error && isOnline && (
                <div className="fcw fcw-message">
                  <div
                    className="fcw fcw-bubble bot"
                    style={{
                      backgroundColor: "#f8d7da",
                      color: "#721c24",
                      border: "1px solid #f5c6cb",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <span>{error}</span>
                    <button
                      onClick={() => window.location.reload()}
                      style={{
                        alignSelf: "flex-start",
                        backgroundColor: "#dc3545",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        padding: "6px 12px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        fontWeight: 500,
                      }}
                      title="Reload page"
                    >
                      <RefreshCw size={14} />
                      Reload
                    </button>
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
                      disabled={!isOnline || loading || isUploading}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <button
                className="schedule-visit"
                onClick={() => {
                  // Send "Showroom Visit" message to chat
                  sendMessage("Showroom Visit");
                  // Scroll to bottom after sending message
                  if (messagesContainerRef.current) {
                    setTimeout(() => {
                      if (messagesContainerRef.current) {
                        messagesContainerRef.current.scrollTop =
                          messagesContainerRef.current.scrollHeight;
                      }
                    }, 100);
                  }
                }}
                disabled={!isOnline || loading || isUploading}
              >
                <Calendar size={16} />
                Schedule Visit
              </button>
            </div>
            <div className="fcw fcw-input">
              {selectedFile && (
                <div className="fcw sellect-file">
                  <span>{selectedFile.name}</span>
                  <button
                    onClick={removeFile}
                    className="fcw-remove-file-btn"
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
                  className="fcw-file-input-hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className={`fcw-file-upload-label${!isOnline || loading || isUploading ? " disabled" : ""
                    }`}
                >
                  <Paperclip size={20} />
                </label>
                <input
                  ref={textInputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={inputPlaceholder}
                />
                <button
                  onClick={
                    input.trim() || selectedFile
                      ? handleSend
                      : handleVoiceToggle
                  }
                  disabled={!isOnline || loading || isUploading}
                  className={
                    !input.trim() && !selectedFile && isVoiceRecording
                      ? "fcw-voice-active"
                      : ""
                  }
                >
                  {loading || isUploading ? (
                    "..."
                  ) : input.trim() || selectedFile ? (
                    <Send size={18} />
                  ) : isVoiceRecording ? (
                    <MicOff size={18} />
                  ) : (
                    <Mic size={18} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindecorChatWidget;
