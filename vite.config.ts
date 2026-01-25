import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.OMO_DASHBOARD_API_PORT ?? "51234"}`,
        changeOrigin: true,
      },
    },
  },
});
