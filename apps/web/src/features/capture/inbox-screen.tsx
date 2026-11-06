"use client";

import { AppFrame } from "../shell/app-frame";
import { CaptureForm } from "./capture-form";
import { InboxList } from "./inbox-list";

export function InboxScreen() {
  return (
    <AppFrame>
      <main className="mx-auto flex max-w-[1160px] flex-wrap items-start gap-8 px-6 pt-10 pb-14">
        <CaptureForm />
        <InboxList />
      </main>
    </AppFrame>
  );
}
