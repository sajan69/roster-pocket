import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  server: {
    allowedHosts: ["terminal.local"],
    host:
      process.env.SITES_MANAGED_LINUX_CONTAINER === "1"
        ? "0.0.0.0"
        : "127.0.0.1",
  },
  plugins: [
    {
      name: "development-style-csp",
      apply: "serve",
      transformIndexHtml(html) {
        return html
          .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
          .replace("connect-src 'none'", "connect-src 'self' ws:");
      },
    },
  ],
});
