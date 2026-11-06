import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  imports: false,
  modules: ["@wxt-dev/module-react"],
  // `pnpm dev` builds to .output/chrome-mv3-dev; load that folder once with "Load unpacked".
  webExt: { disabled: true },
  // The website owns port 3000.
  dev: { server: { port: 3200 } },
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: "Scroll Spark",
    description: "Capture a post you like while scrolling and turn it into your next post.",
    // Each later permission arrives with the issue that uses it, since store review checks them.
    permissions: ["sidePanel"],
    action: { default_title: "Open Scroll Spark" },
  },
});
