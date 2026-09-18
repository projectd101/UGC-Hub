import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // ffmpeg.wasm's packages contain WebAssembly/worker code that Vite's
  // dependency pre-bundler can choke on; excluding them is a no-cost
  // safeguard even though this project loads the actual @ffmpeg/core
  // binary from a CDN at runtime (not from node_modules) via toBlobURL.
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
});
