import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5172, host: true },
  preview: { port: 5172, host: true },
  build: {
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: "mui", test: /node_modules[\\/]@mui|node_modules[\\/]@emotion/ },
            { name: "vendor", test: /node_modules/ },
          ],
        },
      },
    },
  },
});
