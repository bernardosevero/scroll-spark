"use client";

import { Button } from "@scroll-spark/ui/button";
import { SparkMark } from "@scroll-spark/ui/spark-mark";

import { ApiProvider } from "../api/api-provider";
import { CaptureForm } from "./capture-form";
import { InboxList } from "./inbox-list";

export function InboxScreen() {
  return (
    <ApiProvider>
      <header className="border-b-[3px] border-navy bg-paper">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3 px-6 py-3.5">
          <span className="flex items-center gap-2 font-display text-2xl font-extrabold">
            <SparkMark size={24} />
            Scroll Spark
          </span>
          <form action="/api/auth/disconnect" method="post">
            <Button type="submit" variant="plain">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1160px] flex-wrap items-start gap-8 px-6 pt-10 pb-14">
        <CaptureForm />
        <InboxList />
      </main>
    </ApiProvider>
  );
}
