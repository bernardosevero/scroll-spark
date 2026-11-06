"use client";

import { ButtonLink } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";

import { AppFrame } from "../shell/app-frame";
import { DeleteMyData } from "./delete-my-data";

export function SettingsScreen() {
  return (
    <AppFrame>
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 pt-10 pb-14">
        <h1 className="font-display text-5xl leading-none font-extrabold tracking-tight">
          Settings
        </h1>
        <Card className="flex flex-col items-start gap-4">
          <h2 className="font-display text-3xl font-extrabold">The side panel</h2>
          <p className="max-w-2xl">
            See the browsers connected through the Chrome extension, and revoke any of them.
          </p>
          <ButtonLink href="/extension/connect" variant="plain">
            Manage connections
          </ButtonLink>
        </Card>
        <DeleteMyData />
      </main>
    </AppFrame>
  );
}
