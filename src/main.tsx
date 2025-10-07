import React from "react";
import { createRoot } from "react-dom/client";
import FindecorChatWidget from "./FindecorChatWidget";

interface WidgetOptions {
  apiBase?: string;
  socketUrl?: string;
  themeColor?: string;
  userId?: string;
}

// Widget obyekti
const Widget = {
  init: function (options: WidgetOptions = {}) {
    console.log("🚀 init() chaqirildi, options:", options);

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
      root.render(React.createElement(FindecorChatWidget, options));

      console.log("✅ Widget render qilindi");
    } catch (error) {
      console.error("❌ Xatolik:", error);
    }
  },

  destroy: function () {
    const rootDiv = document.getElementById("findecor-chat-root");
    if (rootDiv) {
      rootDiv.remove();
      console.log("🗑️ Widget o'chirildi");
    }
  },
};

// Global export - IIFE ichida
(function () {
  if (typeof window !== "undefined") {
    (window as any).FindecorChatWidget = Widget;
    console.log("✅ FindecorChatWidget window'ga qo'shildi");
  }
})();

export default Widget;
