import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, "package.json"), "utf8")) as {
  version?: string;
};
const version = typeof pkg.version === "string" ? pkg.version : "0.0.0";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    {
      name: "omo-dashboard-title-version",
      transformIndexHtml(html) {
        return html.replace(
          /<title>Agent Dashboard<\/title>/,
          `<title>Agent Dashboard (v${version})</title>`,
        );
      },
    },
  ],
  server: {
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.OMO_DASHBOARD_API_PORT ?? "51234"}`,
        changeOrigin: true,
      },
    },
  },
});
