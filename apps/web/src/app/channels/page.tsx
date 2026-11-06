import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChannelsScreen } from "@/features/channels/channels-screen";
import { currentUserId } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Your channels · Scroll Spark" };

export default async function ChannelsPage() {
  if ((await currentUserId()) === null) {
    redirect("/");
  }

  return <ChannelsScreen />;
}
