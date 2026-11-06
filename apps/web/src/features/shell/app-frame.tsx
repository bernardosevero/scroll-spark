"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@scroll-spark/ui/button";
import { SparkMark } from "@scroll-spark/ui/spark-mark";

import { ApiProvider } from "../api/api-provider";

/** The frame around signed-in pages, until the real shell arrives with #9. */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <ApiProvider>
      <header className="border-b-[3px] border-navy bg-paper">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3 px-6 py-3.5">
          <Link
            href="/inbox"
            className="flex items-center gap-2 font-display text-2xl font-extrabold"
          >
            <SparkMark size={24} />
            Scroll Spark
          </Link>
          <form action="/api/auth/disconnect" method="post">
            <Button type="submit" variant="plain">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      {children}
    </ApiProvider>
  );
}
