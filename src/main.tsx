import React from "react";
import { createRoot } from "react-dom/client";
import FindecorChatWidget from "./FindecorChatWidget";
import "./index.css";

interface WidgetOptions {
  apiBase?: string;
  socketUrl?: string;
  themeColor?: string;
  userId?: string;
  widgetKey?: string;
}

const Widget = {
  init: function (options: WidgetOptions = {}) {
    try {
      let rootDiv = document.getElementById("findecor-chat-root");

      if (rootDiv) {
        console.warn("⚠️ Widget allaqachon mavjud");
        return;
      }

      rootDiv = document.createElement("div");
      rootDiv.id = "findecor-chat-root";
      document.body.appendChild(rootDiv);

      console.log("✅ Root div yaratildi");

      const root = createRoot(rootDiv);

      // Ensure required props are provided
      if (!options.apiBase || !options.socketUrl || !options.widgetKey) {
        console.error(
          "Missing required props: apiBase, socketUrl, and widgetKey are required"
        );
        return;
      }

      const widgetProps = {
        apiBase: options.apiBase,
        socketUrl: options.socketUrl,
        themeColor: options.themeColor,
        userId: options.userId,
        widgetKey: options.widgetKey,
      };

      root.render(React.createElement(FindecorChatWidget, widgetProps));

      console.log("✅ Widget render qilindi");
    } catch (error) {
      console.error("❌ Xatolik:", error);
    }
  },
};

(function () {
  if (typeof window !== "undefined") {
    (window as any).FindecorChatWidget = Widget;
    console.log("✅ FindecorChatWidget window'ga qo'shildi");
  }
})();

export default Widget;
