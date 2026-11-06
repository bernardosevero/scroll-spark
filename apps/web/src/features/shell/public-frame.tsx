import Link from "next/link";
import type { ReactNode } from "react";

import { SparkMark } from "@scroll-spark/ui/spark-mark";

export const REPO_URL = "https://github.com/bernardosevero/scroll-spark";

const LINK = "inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline";

/** The frame around pages anyone can read: the landing page and the privacy page. */
export function PublicFrame({
  isSignedIn,
  children,
}: {
  isSignedIn: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <header className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-6 pt-4">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2 font-display text-2xl font-extrabold"
        >
          <SparkMark size={24} />
          Scroll Spark
        </Link>
        <nav aria-label="Site" className="flex flex-wrap gap-x-6">
          <Link href="/privacy" className={LINK}>
            Privacy
          </Link>
          {isSignedIn && (
            <Link href="/inbox" className={LINK}>
              Your inbox
            </Link>
          )}
        </nav>
      </header>
      {children}
      <footer className="mx-auto mt-10 flex max-w-[1160px] flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t-[3px] border-navy px-6 py-5">
        <p className="font-medium">Built on the Buffer API.</p>
        <div className="flex flex-wrap gap-x-6">
          <Link href="/privacy" className={LINK}>
            Privacy
          </Link>
          <a href={REPO_URL} className={LINK}>
            Source on GitHub
          </a>
        </div>
      </footer>
    </>
  );
}
