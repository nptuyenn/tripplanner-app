import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5000",
      "/healthz": "http://localhost:5000",
      "/readyz": "http://localhost:5000",
      "/metrics": "http://localhost:5000",
    },
  },
});
