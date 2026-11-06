import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InboxScreen } from "@/features/capture/inbox-screen";
import { currentUserId } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Your inbox · Scroll Spark" };

export default async function InboxPage() {
  if ((await currentUserId()) === null) {
    redirect("/");
  }

  return <InboxScreen />;
}
