import React from "react";
import type {
  ChatMessage,
  SchedulePayload,
  CallRequestPayload,
} from "../services/chat/types";
import { ProductRecommendations } from "./ProductRecommendations/ProductRecommendations";
import ScheduleVisitForm from "./ScheduleVisitForm/ScheduleVisitForm";
import CallMeForm from "./CallMeForm/CallMeForm";
import { ImageGenerationLoader } from "./common/loaders/ImageGenerationLoader/ImageGenerationLoader";
import { TypingAnimation } from "./common/loaders/TypingAnimation/TypingAnimation";
import ImageMessage from "./ImageMessage/ImageMessage";
import { Phone, Clock } from "lucide-react";
import type { LoadingType } from "../services/chat/types";

interface ChatMessagesProps {
  messages: ChatMessage[];
  fetching: boolean;
  sendMessage: (
    text: string,
    imageUrl?: string,
    schedule?: SchedulePayload | null,
    callRequest?: CallRequestPayload | null
  ) => Promise<void> | void;
  sendHomeGeneration?: (
    homeImageUrl: string,
    productImageUrl: string,
    prompt?: string
  ) => Promise<void>;
  showScheduleForm: boolean;
  onCloseSchedule: () => void;
  showCallMeForm: boolean;
  onCloseCallMe: () => void;
  widgetKey: string;
  isTyping?: boolean;
  isGeneratingImage?: boolean;
  onGeneratingImageChange?: (isGenerating: boolean) => void;
  loadingStates?: Record<LoadingType, boolean>;
  onScrollToBottom?: () => void;
  onCloseChat?: () => void;
}

// Typewriter effect component - types text character by character
const TypewriterText: React.FC<{
  text: string;
  onComplete?: () => void;
}> = ({ text, onComplete }) => {
  const [displayedText, setDisplayedText] = React.useState("");
  const currentIndexRef = React.useRef(0);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = React.useRef(false);

  React.useEffect(() => {
    // Reset on text change
    setDisplayedText("");
    currentIndexRef.current = 0;
    completedRef.current = false;

    if (!text) {
      onComplete?.();
      return;
    }

    const targetDuration = 3000;
    const calculatedDelay = targetDuration / text.length;
    const delay = Math.min(Math.max(calculatedDelay, 10), 50);

    const typeNextChar = () => {
      if (currentIndexRef.current < text.length) {
        setDisplayedText(text.slice(0, currentIndexRef.current + 1));
        currentIndexRef.current++;
        timeoutRef.current = setTimeout(typeNextChar, delay);
      } else if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    };

    timeoutRef.current = setTimeout(typeNextChar, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [text, onComplete]);

  const isTyping = currentIndexRef.current < text.length && !completedRef.current;

  return (
    <span>
      {displayedText}
      {isTyping && <span className="animate-pulse">|</span>}
    </span>
  );
};

// Sequential typewriter - types information first, then question in SEPARATE bubbles
const SequentialTypewriterMessage: React.FC<{
  information?: string | null;
  question?: string | null;
  isTypingEffect?: boolean;
  timestamp: Date;
  from: "user" | "bot";
  isError?: boolean;
  onScrollToBottom?: () => void;
}> = ({ information, question, isTypingEffect, timestamp, from, isError, onScrollToBottom }) => {
  // Phase: 0 = typing info, 1 = typing question, 2 = complete
  const [phase, setPhase] = React.useState(() => {
    if (!isTypingEffect) return 2; // Skip animation
    if (!information) return 1; // Skip to question
    return 0; // Start with info
  });

  const timeString = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Scroll to bottom when phase changes (new bubble appears)
  React.useEffect(() => {
    if (phase >= 1 && onScrollToBottom) {
      setTimeout(() => onScrollToBottom(), 50);
    }
  }, [phase, onScrollToBottom]);

  const handleInfoComplete = React.useCallback(() => {
    setPhase(question ? 1 : 2);
  }, [question]);

  const handleQuestionComplete = React.useCallback(() => {
    setPhase(2);
  }, []);

  return (
    <>
      {/* Information bubble - always show if exists */}
      {information && (
        <div className={`fcw fcw-bubble ${from === "user" ? "user" : "bot"}`}>
          <div className="fcw fcw-message-text" style={{ whiteSpace: "pre-line" }}>
            {phase === 0 && isTypingEffect ? (
              <TypewriterText
                text={information}
                onComplete={handleInfoComplete}
              />
            ) : (
              information
            )}
          </div>
          <span className="fcw fcw-time">{timeString}</span>
        </div>
      )}
      {/* Question bubble - only show after information completes (phase >= 1) */}
      {question && phase >= 1 && (
        <div
          className={`fcw fcw-bubble ${from === "user" ? "user" : "bot"} ${isError ? "fcw-error-message" : ""}`}
          style={
            isError
              ? {
                backgroundColor: "#fee2e2",
                color: "#991b1b",
                border: "1px solid #fca5a5",
              }
              : undefined
          }
        >
          <div className="fcw fcw-message-text" style={{ whiteSpace: "pre-line" }}>
            {phase === 1 && isTypingEffect ? (
              <TypewriterText
                text={question}
                onComplete={handleQuestionComplete}
              />
            ) : (
              question
            )}
          </div>
          <div className="fcw fcw-time">{timeString}</div>
        </div>
      )}
    </>
  );
};

const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  fetching,
  sendMessage,
  sendHomeGeneration,
  showScheduleForm,
  onCloseSchedule,
  showCallMeForm,
  onCloseCallMe,
  isTyping,
  isGeneratingImage = false,
  onGeneratingImageChange,
  loadingStates = {
    schedule: false,
    callRequest: false,
    image: false,
    ai: false,
    roomGeneration: false,
  },
  onScrollToBottom,
  widgetKey,
  onCloseChat,
}) => {
  const formatDate = (date: Date) =>
    `${String(date.getDate()).padStart(2, "0")}/${String(
      date.getMonth() + 1
    ).padStart(2, "0")}/${date.getFullYear()}`;

  if (fetching) {
    return <div className="fcw fcw-empty">Loading messages…</div>;
  }

  const groupedMessages: Record<string, ChatMessage[]> = {};
  messages.forEach((msg) => {
    if (msg.waitingForTTS) return;

    const d = new Date(msg.timestamp);
    const dateKey = formatDate(d);
    if (!groupedMessages[dateKey]) groupedMessages[dateKey] = [];
    groupedMessages[dateKey].push(msg);
  });

  const sortedDates = Object.keys(groupedMessages).sort((a, b) => {
    const [da, ma, ya] = a.split("/").map(Number);
    const [db, mb, yb] = b.split("/").map(Number);
    return (
      new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime()
    );
  });

  return (
    <>
      {sortedDates.map((date) => {
        const msgs = groupedMessages[date].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
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
                {/* Type: recommend */}
                {msg.type === "recommend" && (
                  <>
                    {/* Products */}
                    {msg.products && msg.products.length > 0 && (
                      <div
                        className={`fcw fcw-bubble ${msg.from === "user" ? "user" : "bot"}`}
                      >
                        <ProductRecommendations
                          products={msg.products}
                          messageText={msg.information ?? undefined}
                          sendHomeGeneration={sendHomeGeneration}
                          isTyping={isTyping}
                          onGeneratingImageChange={onGeneratingImageChange}
                          onScrollToBottom={onScrollToBottom}
                          onProductClick={(product) => {
                            sendMessage(product.name);
                          }}
                          onClose={onCloseChat}
                        />
                        <span className="fcw fcw-time">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    )}
                    {/* Sequential: Information then Question */}
                    <SequentialTypewriterMessage
                      information={msg.information}
                      question={msg.question}
                      isTypingEffect={msg.isTypingEffect}
                      timestamp={msg.timestamp}
                      from={msg.from}
                      onScrollToBottom={onScrollToBottom}
                    />
                  </>
                )}

                {/* Type: qa - Simple text chat */}
                {msg.type === "qa" && (
                  <SequentialTypewriterMessage
                    information={msg.information}
                    question={msg.question}
                    isTypingEffect={msg.isTypingEffect}
                    timestamp={msg.timestamp}
                    from={msg.from}
                    isError={msg.isError}
                    onScrollToBottom={onScrollToBottom}
                  />
                )}

                {/* Type: image_generation */}
                {msg.type === "image_generation" && (
                  <>
                    {/* Generated Photo */}
                    {msg?.generated_photo && (
                      <div
                        className={`fcw fcw-bubble ${msg.from === "user" ? "user" : "bot"}`}
                      >
                        <ImageMessage
                          images={[msg?.generated_photo]}
                          onScrollToBottom={onScrollToBottom}
                        />
                        <span className="fcw fcw-time">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    )}
                    {/* Sequential: Information then Question */}
                    <SequentialTypewriterMessage
                      information={msg.information}
                      question={msg.question}
                      isTypingEffect={msg.isTypingEffect}
                      timestamp={msg.timestamp}
                      from={msg.from}
                      onScrollToBottom={onScrollToBottom}
                    />
                  </>
                )}

                {/* Type: booking - Schedule visit card */}
                {msg.type === "booking" && msg.schedule && (
                  <>
                    {(() => {
                      const schedule = msg.schedule;
                      const isScheduleResponse = (
                        s: typeof schedule
                      ): s is import("../services/chat/types").ScheduleResponse => {
                        return (
                          s !== null &&
                          typeof s === "object" &&
                          ("branch" in s ||
                            "product" in s ||
                            "widgetUser" in s ||
                            "customerName" in s ||
                            "contactInfo" in s)
                        );
                      };

                      const scheduleResponse = isScheduleResponse(schedule)
                        ? schedule
                        : null;
                      const bookedTime = schedule?.bookedTime
                        ? new Date(schedule.bookedTime)
                        : null;
                      const bookedTimeFormatted = bookedTime
                        ? bookedTime.toLocaleString([], {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : undefined;

                      return (
                        <>
                          <div
                            className="fcw fcw-schedule-card"
                            style={{
                              marginTop: 8,
                              padding: "10px 12px",
                              borderRadius: "14px",
                              background: "#f9fafb",
                              border: "1px solid #e5e7eb",
                              fontSize: "12px",
                              lineHeight: 1.5,
                              display: "flex",
                              gap: 8,
                            }}
                          >
                            <div
                              style={{
                                width: 4,
                                borderRadius: "999px",
                                background: "var(--fcw-accent)",
                              }}
                            />
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  marginBottom: 4,
                                  color: "#111827",
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 600,
                                    fontSize: 12,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.4,
                                  }}
                                >
                                  Visit scheduled
                                </span>
                              </div>
                              {scheduleResponse?.branch?.name && (
                                <div style={{ color: "#4b5563" }}>
                                  <span style={{ opacity: 0.8 }}>Branch:</span>{" "}
                                  <strong>{scheduleResponse.branch.name}</strong>
                                </div>
                              )}
                              {scheduleResponse?.product?.name && (
                                <div style={{ color: "#4b5563" }}>
                                  <span style={{ opacity: 0.8 }}>Product:</span>{" "}
                                  <strong>{scheduleResponse.product.name}</strong>
                                </div>
                              )}
                              {bookedTimeFormatted && (
                                <div style={{ color: "#4b5563" }}>
                                  <span style={{ opacity: 0.8 }}>Time:</span>{" "}
                                  <strong>{bookedTimeFormatted}</strong>
                                </div>
                              )}
                              {(scheduleResponse?.customerName ||
                                scheduleResponse?.widgetUser?.firstName) && (
                                  <div style={{ color: "#6b7280", marginTop: 2 }}>
                                    <span style={{ opacity: 0.9 }}>Customer:</span>{" "}
                                    {scheduleResponse?.customerName ||
                                      scheduleResponse.widgetUser?.firstName}
                                    {(scheduleResponse?.contactInfo ||
                                      scheduleResponse?.widgetUser?.contact) && (
                                        <span>
                                          {" "}
                                          (
                                          {scheduleResponse?.contactInfo ||
                                            scheduleResponse.widgetUser?.contact}
                                          )
                                        </span>
                                      )}
                                  </div>
                                )}
                            </div>
                          </div>
                          {/* Sequential: Information then Question */}
                          <SequentialTypewriterMessage
                            information={msg.information}
                            question={msg.question}
                            isTypingEffect={msg.isTypingEffect}
                            timestamp={msg.timestamp}
                            from={msg.from}
                            onScrollToBottom={onScrollToBottom}
                          />
                        </>
                      );
                    })()}
                  </>
                )}

                {/* Legacy support: description */}
                {!msg.type && msg.description && (
                  <div
                    className={`fcw fcw-bubble ${msg.from === "user" ? "user" : "bot"}`}
                  >
                    <div className="fcw fcw-message-text">
                      {msg.isTypingEffect ? (
                        <TypewriterText text={msg.description} />
                      ) : (
                        msg.description
                      )}
                    </div>
                    <span className="fcw fcw-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}

                {/* Legacy support: products without type */}
                {!msg.type && msg.products && msg.products.length > 0 && (
                  <div
                    className={`fcw fcw-bubble ${msg.from === "user" ? "user" : "bot"}`}
                  >
                    <ProductRecommendations
                      products={msg.products}
                      messageText={msg.description ?? undefined}
                      sendHomeGeneration={sendHomeGeneration}
                      isTyping={isTyping}
                      onGeneratingImageChange={onGeneratingImageChange}
                      onScrollToBottom={onScrollToBottom}
                      onProductClick={(product) => {
                        sendMessage(product.name);
                      }}
                      onClose={onCloseChat}
                    />
                    <span className="fcw fcw-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}

                {/* Legacy support: images without type */}
                {!msg.type &&
                  (msg.images && msg.images.length > 0 || msg.isUploading) && (
                    <div
                      className={`fcw fcw-bubble ${msg.from === "user" ? "user" : "bot"}`}
                    >
                      {msg.isUploading && msg.fileName ? (
                        <div className="fcw-upload-loader">
                          <div className="fcw-upload-spinner" />
                          <span className="fcw-upload-filename">
                            {msg.fileName}
                          </span>
                        </div>
                      ) : (
                        <ImageMessage
                          images={msg.images}
                          onScrollToBottom={onScrollToBottom}
                        />
                      )}
                      <span className="fcw fcw-time">
                        {msg.isPending ? (
                          <Clock size={12} />
                        ) : (
                          new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        )}
                      </span>
                    </div>
                  )}

                {/* Legacy support: text */}
                {!msg.type && msg.text && (
                  <div
                    className={`fcw fcw-bubble ${msg.from === "user" ? "user" : "bot"} ${msg.isError ? "fcw-error-message" : ""}`}
                    style={
                      msg.isError
                        ? {
                          backgroundColor: "#fee2e2",
                          color: "#991b1b",
                          border: "1px solid #fca5a5",
                        }
                        : undefined
                    }
                  >
                    <div className="fcw fcw-message-text">{msg.text}</div>
                    <div className="fcw fcw-time">
                      {msg.isPending ? (
                        <Clock size={12} />
                      ) : (
                        new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Legacy support: schedule without type */}
                {!msg.type && msg.schedule && (
                  <>
                    {(() => {
                      const schedule = msg.schedule;
                      const isScheduleResponse = (
                        s: typeof schedule
                      ): s is import("../services/chat/types").ScheduleResponse => {
                        return (
                          s !== null &&
                          typeof s === "object" &&
                          ("branch" in s ||
                            "product" in s ||
                            "widgetUser" in s ||
                            "customerName" in s ||
                            "contactInfo" in s)
                        );
                      };

                      const scheduleResponse = isScheduleResponse(schedule)
                        ? schedule
                        : null;
                      const bookedTime = schedule?.bookedTime
                        ? new Date(schedule.bookedTime)
                        : null;
                      const bookedTimeFormatted = bookedTime
                        ? bookedTime.toLocaleString([], {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : undefined;

                      return (
                        <div
                          className="fcw fcw-schedule-card"
                          style={{
                            marginTop: 8,
                            padding: "10px 12px",
                            borderRadius: "14px",
                            background: "#f9fafb",
                            border: "1px solid #e5e7eb",
                            fontSize: "12px",
                            lineHeight: 1.5,
                            display: "flex",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              width: 4,
                              borderRadius: "999px",
                              background: "var(--fcw-accent)",
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                marginBottom: 4,
                                color: "#111827",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontSize: 12,
                                  textTransform: "uppercase",
                                  letterSpacing: 0.4,
                                }}
                              >
                                Visit scheduled
                              </span>
                            </div>
                            {scheduleResponse?.branch?.name && (
                              <div style={{ color: "#4b5563" }}>
                                <span style={{ opacity: 0.8 }}>Branch:</span>{" "}
                                <strong>{scheduleResponse.branch.name}</strong>
                              </div>
                            )}
                            {scheduleResponse?.product?.name && (
                              <div style={{ color: "#4b5563" }}>
                                <span style={{ opacity: 0.8 }}>Product:</span>{" "}
                                <strong>{scheduleResponse.product.name}</strong>
                              </div>
                            )}
                            {bookedTimeFormatted && (
                              <div style={{ color: "#4b5563" }}>
                                <span style={{ opacity: 0.8 }}>Time:</span>{" "}
                                <strong>{bookedTimeFormatted}</strong>
                              </div>
                            )}
                            {(scheduleResponse?.customerName ||
                              scheduleResponse?.widgetUser?.firstName) && (
                                <div style={{ color: "#6b7280", marginTop: 2 }}>
                                  <span style={{ opacity: 0.9 }}>Customer:</span>{" "}
                                  {scheduleResponse?.customerName ||
                                    scheduleResponse.widgetUser?.firstName}
                                  {(scheduleResponse?.contactInfo ||
                                    scheduleResponse?.widgetUser?.contact) && (
                                      <span>
                                        {" "}
                                        (
                                        {scheduleResponse?.contactInfo ||
                                          scheduleResponse.widgetUser?.contact}
                                        )
                                      </span>
                                    )}
                                </div>
                              )}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                {msg?.callRequest &&
                  (() => {
                    const callRequest = msg.callRequest;

                    return (
                      <div
                        className="fcw fcw-call-request-card"
                        style={{
                          marginTop: 8,
                          padding: "8px 10px",
                          borderRadius: "10px",
                          background:
                            "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                          border: "1px solid #86efac",
                          fontSize: "12px",
                          lineHeight: 1.4,
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: "#22c55e",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Phone size={14} color="white" strokeWidth={2.5} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              marginBottom: 4,
                              color: "#166534",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: 11,
                                textTransform: "uppercase",
                                letterSpacing: 0.3,
                              }}
                            >
                              Call Request
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            {callRequest?.name && (
                              <div
                                style={{
                                  color: "#166534",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                }}
                              >
                                <span style={{ opacity: 0.7 }}>Name:</span>
                                <strong style={{ fontSize: 11 }}>
                                  {callRequest.name}
                                </strong>
                              </div>
                            )}
                            {callRequest?.phoneNumber && (
                              <div
                                style={{
                                  color: "#166534",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                }}
                              >
                                <span style={{ opacity: 0.7 }}>Phone:</span>
                                <strong
                                  style={{
                                    fontSize: 11,
                                    fontFamily: "monospace",
                                    letterSpacing: 0.3,
                                  }}
                                >
                                  {callRequest.phoneNumber}
                                </strong>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            ))}
            {showScheduleForm && (
              <ScheduleVisitForm
                widgetKey={widgetKey}
                onClose={onCloseSchedule}
                onSubmitSchedule={async (schedule) => {
                  await sendMessage("", "", schedule);
                  if (onScrollToBottom) {
                    setTimeout(() => {
                      onScrollToBottom();
                    }, 100);
                  }
                }}
              />
            )}
            {showCallMeForm && (
              <CallMeForm
                onClose={onCloseCallMe}
                onSubmitCallRequest={async (callRequest) => {
                  await sendMessage("", "", null, callRequest);
                  if (onScrollToBottom) {
                    setTimeout(() => {
                      onScrollToBottom();
                    }, 100);
                  }
                }}
              />
            )}
          </div>
        );
      })}
      {/* Dynamic loading indicators */}
      {loadingStates.roomGeneration && (
        <div className="fcw fcw-typing-row">
          <div className="fcw fcw-bubble bot">
            <ImageGenerationLoader />
          </div>
        </div>
      )}
      {loadingStates.image && (
        <div className="fcw fcw-typing-row">
          <div className="fcw fcw-bubble bot">
            <TypingAnimation
              mode="text"
              messages={[
                "Processing room details",
                "Detecting interior design style",
                "Extracting room color palette",
                "Estimating floor area",
                "Searching products",
              ]}
            />
          </div>
        </div>
      )}
      {(loadingStates.schedule ||
        loadingStates.callRequest ||
        loadingStates.ai) && (
          <div className="fcw fcw-typing-row">
            <div className="fcw fcw-bubble bot">
              <TypingAnimation mode="dots" />
            </div>
          </div>
        )}
      {isGeneratingImage && !loadingStates.roomGeneration && (
        <div className="fcw fcw-typing-row">
          <div className="fcw fcw-bubble bot">
            <ImageGenerationLoader />
          </div>
        </div>
      )}
    </>
  );
};

export default ChatMessages;
