import type { Metadata } from "next";

import { ExtensionConnect } from "@/features/extension/extension-connect";
import { ExtensionSignedOut } from "@/features/extension/extension-signed-out";
import { currentUserId } from "@/server/auth/current-user";
import { getEnv } from "@/server/env";

export const metadata: Metadata = { title: "Connect the side panel · Scroll Spark" };

export default async function ExtensionConnectPage() {
  if ((await currentUserId()) === null) {
    return <ExtensionSignedOut />;
  }

  // The ID comes from configuration, never the URL, so a link can't send a token elsewhere.
  const { EXTENSION_ORIGIN } = getEnv();
  const extensionId = EXTENSION_ORIGIN === undefined ? null : new URL(EXTENSION_ORIGIN).hostname;

  return <ExtensionConnect extensionId={extensionId} />;
}
