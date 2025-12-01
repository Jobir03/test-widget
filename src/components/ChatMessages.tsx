import React from "react";
import type { ChatMessage, SchedulePayload } from "../services/chat/types";
import { ProductRecommendations } from "./ProductRecommendations/ProductRecommendations";
import ScheduleVisitForm from "./ScheduleVisitForm/ScheduleVisitForm";
import { ImageGenerationLoader } from "./common/loaders/ImageGenerationLoader/ImageGenerationLoader";

interface ChatMessagesProps {
  messages: ChatMessage[];
  fetching: boolean;
  sendMessage: (
    text: string,
    imageUrl?: string,
    schedule?: SchedulePayload | null
  ) => Promise<void> | void;
  sendHomeGeneration?: (
    homeImageUrl: string,
    productImageUrl: string,
    prompt?: string
  ) => Promise<void>;
  showScheduleForm: boolean;
  onCloseSchedule: () => void;
  widgetKey: string;
  isTyping?: boolean;
  isGeneratingImage?: boolean;
  onGeneratingImageChange?: (isGenerating: boolean) => void;
  onScrollToBottom?: () => void;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  fetching,
  sendMessage,
  sendHomeGeneration,
  showScheduleForm,
  onCloseSchedule,
  isTyping,
  isGeneratingImage = false,
  onGeneratingImageChange,
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
                    {msg.description}
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
                    style={{
                      width: "100%",
                    }}
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
                          onLoad={() => {
                            // Scroll to bottom after image is fully loaded
                            if (
                              onScrollToBottom &&
                              idx === msg.images.length - 1
                            ) {
                              setTimeout(() => {
                                onScrollToBottom();
                              }, 50);
                            }
                          }}
                        />
                      ))}
                    </div>
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
                    {msg.text}
                    <span className="fcw fcw-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}

                {msg?.schedule &&
                  (() => {
                    const schedule: any = msg.schedule as any;
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
                          {schedule?.branch?.name && (
                            <div style={{ color: "#4b5563" }}>
                              <span style={{ opacity: 0.8 }}>Branch:</span>{" "}
                              <strong>{schedule.branch.name}</strong>
                            </div>
                          )}
                          {schedule?.product?.name && (
                            <div style={{ color: "#4b5563" }}>
                              <span style={{ opacity: 0.8 }}>Product:</span>{" "}
                              <strong>{schedule.product.name}</strong>
                            </div>
                          )}
                          {bookedTimeFormatted && (
                            <div style={{ color: "#4b5563" }}>
                              <span style={{ opacity: 0.8 }}>Time:</span>{" "}
                              <strong>{bookedTimeFormatted}</strong>
                            </div>
                          )}
                          {schedule?.widgetUser?.firstName && (
                            <div
                              style={{
                                color: "#6b7280",
                                marginTop: 2,
                              }}
                            >
                              <span style={{ opacity: 0.9 }}>Customer:</span>{" "}
                              {schedule.widgetUser.firstName}
                              {schedule.widgetUser.contact
                                ? ` (${schedule.widgetUser.contact})`
                                : ""}
                            </div>
                          )}
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
          </div>
        );
      })}
      {isGeneratingImage && (
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
