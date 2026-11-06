import type { PendingCapture } from "../capture/pending-capture";
import type { StoredToken } from "../lib/connect-message";

/** Everything the panel reads from Chrome, so tests can stand in for it. */
export interface PanelEnvironment {
  readToken(): Promise<StoredToken | null>;
  readPending(): Promise<PendingCapture | null>;
  clearPending(): Promise<void>;
  /** Calls back when the token or the waiting capture changes. Returns a way to stop. */
  onChange(listener: () => void): () => void;
}

export const chromeEnvironment: PanelEnvironment = {
  async readToken() {
    const { token } = await chrome.storage.local.get("token");
    return (token as StoredToken | undefined) ?? null;
  },

  async readPending() {
    const { pending } = await chrome.storage.session.get("pending");
    return (pending as PendingCapture | undefined) ?? null;
  },

  clearPending: () => chrome.storage.session.remove("pending"),

  onChange(listener) {
    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  },
};
