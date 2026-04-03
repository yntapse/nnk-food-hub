import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: ["./client", "./shared", "./public"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    configureServer(server) {
      // Add a synchronous placeholder middleware BEFORE Vite's internal middleware
      // (SPA fallback, static file, etc.) so API requests are captured first.
      // The actual Express app is loaded asynchronously to avoid bundling PrismaClient.
      let expressApp: ((req: any, res: any, next: any) => void) | null = null;

      server.middlewares.use("/api", (req, res, next) => {
        if (expressApp) {
          // Restore the full URL so Express sees /api/... paths
          req.url = "/api" + (req.url ?? "");
          expressApp(req, res, next);
        } else {
          next();
        }
      });

      import("./server").then(({ createServer }) => {
        // Pass Vite's httpServer so socket.io binds to the same port (8080)
        const { app } = createServer((server.httpServer as import("http").Server) ?? undefined);
        expressApp = app;
      }).catch((err) => {
        console.error("[express-plugin] Failed to load server:", err);
      });
    },
  };
}
