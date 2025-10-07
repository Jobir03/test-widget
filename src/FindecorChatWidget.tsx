import React, { useState } from "react";
import { MessageSquare } from "lucide-react";

interface FindecorChatWidgetProps {
  apiBase?: string;
  socketUrl?: string;
  themeColor?: string;
  userId?: string;
}

const mockMessages = [
  { id: 1, from: "bot", text: "Salom! Men Findecor yordamchisiman 😊" },
  { id: 2, from: "bot", text: "Sizga qanday yordam kerak?" },
];

const FindecorChatWidget: React.FC<FindecorChatWidgetProps> = ({
  themeColor = "#007AFF",
}) => {
  const [messages, setMessages] = useState(mockMessages);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMsg = { id: Date.now(), from: "user", text: input };
    setMessages([...messages, newMsg]);
    setInput("");

    // Mock javob
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, from: "bot", text: "Qabul qilindi ✅" },
      ]);
    }, 1000);
  };

  return (
    <>
      {/* Chat button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          background: themeColor,
          border: "none",
          borderRadius: "50%",
          width: "56px",
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#fff",
          boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
          transition: "all 0.3s ease",
          zIndex: 9999,
        }}
      >
        <MessageSquare size={26} />
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: "90px",
            right: "24px",
            width: "360px",
            height: "480px",
            background: "#fff",
            borderRadius: "16px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            border: `1px solid ${themeColor}`,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: themeColor,
              color: "#fff",
              padding: "12px 16px",
              fontWeight: "bold",
            }}
          >
            Findecor Assistant
          </div>

          <div
            style={{
              flex: 1,
              padding: "10px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              background: "#fafafa",
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.from === "user" ? "flex-end" : "flex-start",
                  background: m.from === "user" ? themeColor : "#e6e6e6",
                  color: m.from === "user" ? "#fff" : "#000",
                  padding: "8px 12px",
                  borderRadius: "12px",
                  maxWidth: "80%",
                }}
              >
                {m.text}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              padding: "8px",
              borderTop: "1px solid #ddd",
            }}
          >
            <input
              type="text"
              value={input}
              placeholder="Xabar yozing..."
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                padding: "8px",
                fontSize: "14px",
              }}
            />
            <button
              style={{
                background: themeColor,
                border: "none",
                color: "#fff",
                borderRadius: "8px",
                padding: "6px 12px",
                cursor: "pointer",
              }}
              onClick={sendMessage}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default FindecorChatWidget;
