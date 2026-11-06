import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "@scroll-spark/ui/card";

import { PublicFrame } from "@/features/shell/public-frame";
import { currentUserId } from "@/server/auth/current-user";

export const metadata: Metadata = {
  title: "Privacy · Scroll Spark",
  description: "What Scroll Spark keeps, who else sees it, and how to take it all back.",
};

function Section({
  title,
  isFeatured = false,
  children,
}: {
  title: string;
  isFeatured?: boolean;
  children: ReactNode;
}) {
  return (
    <Card isFeatured={isFeatured} className="flex flex-col gap-3">
      <h2 className="font-display text-3xl font-extrabold">{title}</h2>
      {children}
    </Card>
  );
}

const LIST = "flex list-disc flex-col gap-1.5 pl-6";
const LINK = "font-bold text-blue underline underline-offset-4";

export default async function PrivacyPage() {
  const isSignedIn = (await currentUserId()) !== null;

  return (
    <PublicFrame isSignedIn={isSignedIn}>
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 pt-10 pb-6">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-6xl leading-none font-extrabold tracking-tight">
            Privacy
          </h1>
          <p className="text-xl">
            Plain words about what Scroll Spark keeps, who else sees it, and how to take it all
            back.
          </p>
        </header>

        <Section title="What we store">
          <ul className={LIST}>
            <li>
              The text you captured, about 1,000 characters at most, with its link and platform
            </li>
            <li>What the AI returned: a summary, topic, angle and trend phrases</li>
            <li>Your Buffer organization and channel IDs</li>
            <li>Your Buffer connection, as encrypted tokens</li>
            <li>Cached post text from your channels, with summaries and topic clusters</li>
            <li>Extension tokens, as hashes only</li>
          </ul>
        </Section>

        <Section title="What we don't store">
          <ul className={LIST}>
            <li>Your browsing history</li>
            <li>Anything you didn&apos;t choose to capture</li>
          </ul>
        </Section>

        <Section title="Who else sees your data">
          <ul className={LIST}>
            <li>Other Scroll Spark users: nobody. Nothing is shared between users.</li>
            <li>
              Anthropic: the text you capture is sent to Anthropic for analysis. Post drafts get the
              angle and summary, never the source text.
            </li>
            <li>
              Buffer: only what you explicitly save or post. Capturing never writes to Buffer.
            </li>
            <li>
              Sites you link to: when you paste a link, our server opens that one page to read its
              title and description, and YouTube links go to YouTube. It sends no details about you.
            </li>
          </ul>
        </Section>

        <Section title="The extension">
          <p>
            The extension reads a page only after you ask it to. It uses Chrome&apos;s{" "}
            <code className="rounded-print bg-stone px-1.5">activeTab</code> permission, so it never
            sees pages you didn&apos;t ask about, and it doesn&apos;t watch your browsing.
          </p>
          <p>
            It signs in with a random token that lasts 30 days. We keep only a hash of it, and it
            never gives direct access to your Buffer account.
          </p>
        </Section>

        <Section title="Disconnect, revoke and delete" isFeatured>
          <ul className={LIST}>
            <li>
              <b>Sign out</b> ends your session in this browser. It deletes nothing.
            </li>
            <li>
              <b>Stop Scroll Spark using your Buffer account</b> by removing it in your Buffer
              account settings. Buffer documents no way for an app to end its own access, so that
              step is yours.
            </li>
            <li>
              <b>Revoke an extension token</b> in{" "}
              <Link href="/settings" className={LINK}>
                Settings
              </Link>
              . Deleting your data removes them all.
            </li>
            <li>
              <b>Delete your data</b> in{" "}
              <Link href="/settings" className={LINK}>
                Settings
              </Link>
              . It removes everything listed above right away, and signs you out.
            </li>
          </ul>
        </Section>
      </main>
    </PublicFrame>
  );
}
