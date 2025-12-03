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
import { Phone } from "lucide-react";
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
}

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
                {msg?.description && (
                  <div
                    className={`fcw fcw-bubble ${
                      msg.from === "user" ? "user" : "bot"
                    }`}
                  >
                    <div className="fcw fcw-message-text">
                      {msg.description}
                    </div>
                    <span className="fcw fcw-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
                {msg?.products && msg.products.length > 0 && (
                  <div
                    className={`fcw fcw-bubble ${
                      msg.from === "user" ? "user" : "bot"
                    }`}
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
                    />

                    <span className="fcw fcw-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
                {msg?.images && msg.images.length > 0 && (
                  <div
                    className={`fcw fcw-bubble ${
                      msg.from === "user" ? "user" : "bot"
                    }`}
                  >
                    <ImageMessage
                      images={msg.images}
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

                {msg?.text && (
                  <div
                    className={`fcw fcw-bubble ${
                      msg.from === "user" ? "user" : "bot"
                    } ${msg.isError ? "fcw-error-message" : ""}`}
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
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                )}

                {msg?.schedule &&
                  (() => {
                    const schedule = msg.schedule;
                    // Type guard to check if it's ScheduleResponse (has populated relations)
                    const isScheduleResponse = (
                      s: typeof schedule
                    ): s is import("../services/chat/types").ScheduleResponse => {
                      return (
                        s !== null &&
                        typeof s === "object" &&
                        ("branch" in s || "product" in s || "widgetUser" in s)
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
                          {scheduleResponse?.widgetUser?.firstName && (
                            <div
                              style={{
                                color: "#6b7280",
                                marginTop: 2,
                              }}
                            >
                              <span style={{ opacity: 0.9 }}>Customer:</span>{" "}
                              {scheduleResponse.widgetUser.firstName}
                              {scheduleResponse.widgetUser.contact
                                ? ` (${scheduleResponse.widgetUser.contact})`
                                : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

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
                  // Scroll to bottom after schedule is submitted
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
                  // Scroll to bottom after call request is submitted
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
      {/* Dynamic loading indicators based on socket events */}
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
      {/* Legacy support for isGeneratingImage */}
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
