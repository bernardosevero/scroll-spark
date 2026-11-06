import { defineBackground } from "wxt/utils/define-background";

import { pendingFrom } from "../capture/pending-capture";
import { parseConnectMessage } from "../lib/connect-message";
import { WEB_ORIGIN } from "../lib/config";
import { connectOrigins } from "../lib/origins";

const MENU_ID = "capture";

/**
 * Reads the tab the user acted on, once, and leaves the result for the side panel. Toolbar click,
 * right-click menu and keyboard shortcut all come through here, and each one grants `activeTab`
 * for this tab only. Nothing here runs unless the user did one of them.
 */
async function readTab(tab: chrome.tabs.Tab, id: string) {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: Number(tab.id) },
      files: ["/capture.js"],
    });

    return pendingFrom({ id, result: injection?.result, tabUrl: tab.url, couldRead: true });
  } catch {
    return pendingFrom({ id, result: null, tabUrl: tab.url, couldRead: false });
  }
}

function startCapture(tab: chrome.tabs.Tab | undefined) {
  if (tab?.id === undefined) {
    return;
  }

  // Open first. Chrome only lets a panel open while the click is still fresh, and reading the
  // page takes longer. The panel shows what we leave in storage as soon as it arrives.
  void chrome.sidePanel.open({ tabId: tab.id });
  void readTab(tab, crypto.randomUUID()).then((pending) => chrome.storage.session.set({ pending }));
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    void chrome.contextMenus.removeAll().then(() => {
      chrome.contextMenus.create({
        id: MENU_ID,
        title: "Capture with Scroll Spark",
        contexts: ["page", "selection"],
      });
    });
  });

  // Fires for the toolbar icon and for the `_execute_action` shortcut. There is no popup.
  chrome.action.onClicked.addListener(startCapture);
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === MENU_ID) {
      startCapture(tab);
    }
  });

  // The website's connect page hands over a sign-in token. The manifest already limits who may
  // send; checking the origin again keeps that true if the manifest ever widens.
  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    const token = parseConnectMessage(message);

    if (token === null || !connectOrigins(WEB_ORIGIN).includes(sender.origin ?? "")) {
      sendResponse({ ok: false });
      return;
    }

    void chrome.storage.local.set({ token }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  });
});
