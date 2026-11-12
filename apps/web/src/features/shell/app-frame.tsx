"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@scroll-spark/ui/button";
import { ReconnectNotice } from "@scroll-spark/ui/reconnect-notice";
import { SparkMark } from "@scroll-spark/ui/spark-mark";

import { ApiProvider } from "../api/api-provider";
import { SiteCredit } from "./site-credit";
import { useReconnectNeeded } from "./use-reconnect-needed";

const NAV = [
  { href: "/inbox", label: "Inbox" },
  { href: "/channels", label: "Your channels" },
  { href: "/settings", label: "Settings" },
] as const;

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="order-last w-full sm:order-none sm:w-auto">
      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        {NAV.map(({ href, label }) => {
          const isHere = isCurrent(pathname, href);

          return (
            <li key={href}>
              {/* The thick underline marks the page, so colour never has to. */}
              <Link
                href={href}
                aria-current={isHere ? "page" : undefined}
                className={`inline-flex min-h-11 items-center border-b-4 px-0.5 text-lg ${
                  isHere
                    ? "border-spark font-extrabold"
                    : "border-transparent font-medium hover:border-navy/30"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const isReconnectNeeded = useReconnectNeeded();

  return (
    <>
      {isReconnectNeeded && <ReconnectNotice href="/api/auth/connect" />}
      <header className="border-b-[3px] border-navy bg-paper">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-x-8 gap-y-1 px-6 py-3">
          <Link
            href="/inbox"
            className="flex min-h-11 items-center gap-2 font-display text-2xl font-extrabold"
          >
            <SparkMark size={24} />
            Scroll Spark
          </Link>
          <MainNav />
          <form action="/api/auth/disconnect" method="post" className="sm:ml-auto">
            <Button type="submit" variant="plain" className="min-h-11! py-1 text-base">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      {children}
      <footer className="mx-auto mt-10 max-w-[1160px] border-t-[3px] border-navy px-6 py-5">
        <SiteCredit />
      </footer>
    </>
  );
}

/** The frame around every signed-in page: the way between them, and the way out. */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <ApiProvider>
      <Shell>{children}</Shell>
    </ApiProvider>
  );
}
