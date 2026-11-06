import { defineUnlistedScript } from "wxt/utils/define-unlisted-script";

import { capturePage } from "../capture/page-capture";

/**
 * Injected by the background script after a user action, never declared in the manifest. Its
 * return value is what `executeScript` hands back.
 */
export default defineUnlistedScript(() =>
  capturePage(document, {
    url: location.href,
    selection: getSelection()?.toString() ?? "",
    viewportHeight: window.innerHeight,
    measure: (element) => element.getBoundingClientRect(),
  }),
);
