import React from "react";
import { createRoot } from "react-dom/client";
import FindecorChatWidget from "./FindecorChatWidget";
import "./index.css";

interface WidgetOptions {
  apiBase?: string;
  socketUrl?: string;
  widgetKey?: string;
  userId?: string;
  color?: string;
  textColor?: string;
  widgetSize?: "small" | "medium" | "large";
  position?: "TL" | "TR" | "BL" | "BR";
  borderRadius?: string;
  companyName?: string;
  autoOpen?: boolean;
  headerText?: string;
  offlineMessage?: string;
  inputPlaceholder?: string;
}

const DEFAULT_CONFIG: Required<
  Omit<WidgetOptions, "apiBase" | "socketUrl" | "widgetKey" | "userId">
> = {
  color: "#0b0b19",
  textColor: "#ffffff",
  widgetSize: "medium",
  position: "BR",
  borderRadius: "20px",
  companyName: "Sales Assistant",
  autoOpen: false,
  headerText: "Sales Assistant",
  offlineMessage:
    "We're currently offline. Please leave a message and we'll get back to you soon.",
  inputPlaceholder: "Type your message...",
};

const Widget = {
  init: function (options: WidgetOptions = {}) {
    try {
      let rootDiv = document.getElementById("findecor-chat-root");
      if (rootDiv) return;

      rootDiv = document.createElement("div");
      rootDiv.id = "findecor-chat-root";
      document.body.appendChild(rootDiv);
      const root = createRoot(rootDiv);

      // Ensure required props are provided
      if (!options.apiBase || !options.socketUrl || !options.widgetKey) {
        console.error(
          "Missing required props: apiBase, socketUrl, and widgetKey are required"
        );
        return;
      }

      // Merge options with defaults
      const config = {
        ...DEFAULT_CONFIG,
        color: options.color ?? DEFAULT_CONFIG.color,
        textColor: options.textColor ?? DEFAULT_CONFIG.textColor,
        widgetSize: options.widgetSize ?? DEFAULT_CONFIG.widgetSize,
        position: options.position ?? DEFAULT_CONFIG.position,
        borderRadius: options.borderRadius ?? DEFAULT_CONFIG.borderRadius,
        companyName: options.companyName ?? DEFAULT_CONFIG.companyName,
        autoOpen: options.autoOpen ?? DEFAULT_CONFIG.autoOpen,
        headerText: options.headerText ?? DEFAULT_CONFIG.headerText,
        offlineMessage: options.offlineMessage ?? DEFAULT_CONFIG.offlineMessage,
        inputPlaceholder:
          options.inputPlaceholder ?? DEFAULT_CONFIG.inputPlaceholder,
      };

      const widgetProps = {
        apiBase: options.apiBase,
        socketUrl: options.socketUrl,
        widgetKey: options.widgetKey,
        userId: options.userId,
        ...config,
      };
      root.render(React.createElement(FindecorChatWidget, widgetProps));
    } catch (error) {
      console.error("❌ Error:", error);
    }
  },
};

(function () {
  if (typeof window !== "undefined") {
    (
      window as unknown as { FindecorChatWidget: typeof Widget }
    ).FindecorChatWidget = Widget;
  }
})();

export default Widget;
