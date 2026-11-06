import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SettingsScreen } from "@/features/settings/settings-screen";
import { currentUserId } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Settings · Scroll Spark" };

export default async function SettingsPage() {
  if ((await currentUserId()) === null) {
    redirect("/");
  }

  return <SettingsScreen />;
}
