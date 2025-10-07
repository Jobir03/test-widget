import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    lib: {
      entry: "src/main.tsx",
      name: "FindecorChatWidget",
      fileName: () => `findecor-chat-widget.umd.js`,
      formats: ["umd"],
    },
    rollupOptions: {
      output: {
        name: "FindecorChatWidget",
        exports: "named",
        globals: {},
      },
    },
    minify: false, // Debug uchun
  },
});
