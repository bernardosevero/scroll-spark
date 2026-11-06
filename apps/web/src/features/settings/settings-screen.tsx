"use client";

import { AppFrame } from "../shell/app-frame";
import { DeleteMyData } from "./delete-my-data";

export function SettingsScreen() {
  return (
    <AppFrame>
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 pt-10 pb-14">
        <h1 className="font-display text-5xl leading-none font-extrabold tracking-tight">
          Settings
        </h1>
        <DeleteMyData />
      </main>
    </AppFrame>
  );
}
