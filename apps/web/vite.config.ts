import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_GITHUB_PAGES_BASE || "/",
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icon.svg", ".nojekyll", "version.json"],
        manifest: {
          name: env.VITE_APP_NAME || "CampFlow",
          short_name: "CampFlow",
          description: "친구들과 함께 만드는 글램핑 여행 플래너",
          theme_color: "#18324a",
          background_color: "#f8f5ef",
          display: "standalone",
          lang: "ko-KR",
          start_url: "./#/",
          icons: [
            {
              src: "icon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          navigateFallback: "index.html",
          cleanupOutdatedCaches: true,
          globPatterns: ["**/*.{js,css,html,svg,json,woff2}"],
          runtimeCaching: [],
        },
      }),
    ],
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      css: true,
    },
  };
});
