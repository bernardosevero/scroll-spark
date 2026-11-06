interface ChromeRuntime {
  lastError?: { message?: string };
  sendMessage(extensionId: string, message: unknown, callback: (reply: unknown) => void): void;
}

/** Sent to the side panel's background script. Keep in step with the extension's listener. */
export interface ConnectMessage {
  type: "scroll-spark.connect";
  token: string;
  expiresAt: string;
}

/**
 * Hands a token to our extension, using the messaging that its manifest's `externally_connectable`
 * allows this origin to use. True only when the extension answered that it kept the token.
 */
export function sendToExtension({
  extensionId,
  message,
}: {
  extensionId: string;
  message: ConnectMessage;
}): Promise<boolean> {
  const runtime = (window as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;

  if (runtime?.sendMessage === undefined) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    try {
      runtime.sendMessage(extensionId, message, (reply) => {
        // Reading `lastError` is what keeps Chrome from logging an unchecked error.
        const hasFailed = runtime.lastError !== undefined;
        resolve(!hasFailed && (reply as { ok?: unknown } | undefined)?.ok === true);
      });
    } catch {
      resolve(false);
    }
  });
}
