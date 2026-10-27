import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // "production", "preview" or "development"; Vercel sets VERCEL_ENV during the build.
  define: { __APP_ENV__: JSON.stringify(process.env.VERCEL_ENV || "development") },
  test: { environment: "node" }
});
