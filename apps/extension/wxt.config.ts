import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

import { connectOrigins, webOriginFrom } from "./src/lib/origins";

// Build-time values, all optional. See `.env.example`. WXT reads `.env` files for the app's own
// code but not for this file, so load them here too, or the manifest and the app would disagree.
// Values already in the environment win over files.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // No such file, which is fine.
  }
}

const webOrigin = webOriginFrom(process.env.WXT_API_ORIGIN);
/** The public key from the store upload. It pins one extension ID across unpacked and store builds. */
const extensionKey = process.env.WXT_EXTENSION_KEY?.trim();

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
    ...(extensionKey ? { key: extensionKey } : {}),
    minimum_chrome_version: "116",
    // Store review checks these, so each is here only because code uses it, and there are no
    // host permissions: `activeTab` covers the tab the user acts on, and nothing else.
    //   activeTab     read the tab the user clicked, pressed the shortcut or right-clicked on
    //   scripting     inject the one capture script into that tab
    //   sidePanel     show the captured text beside the page
    //   contextMenus  the "Capture with Scroll Spark" right-click item
    //   storage       the sign-in token, and the capture waiting for the panel
    permissions: ["activeTab", "scripting", "sidePanel", "contextMenus", "storage"],
    action: { default_title: "Capture with Scroll Spark" },
    commands: {
      _execute_action: {
        suggested_key: { default: "Alt+Shift+S" },
        description: "Capture with Scroll Spark",
      },
    },
    // Only our own website may hand the extension its sign-in token.
    externally_connectable: { matches: connectOrigins(webOrigin).map((origin) => `${origin}/*`) },
  },
});
