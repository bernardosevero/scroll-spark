import { ButtonLink } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";
import { Reveal } from "@scroll-spark/ui/reveal";

import { REPO_URL } from "../shell/public-frame";
import { CaptureToFit } from "./capture-to-fit";

const STEPS = [
  {
    title: "Capture",
    body: "Keep a post that caught your eye. Paste it, or send it from the extension.",
  },
  {
    title: "Check the fit",
    body: "See how many posts on each channel already cover it, and when you last did.",
  },
  {
    title: "Make it yours",
    body: "Save it as a Buffer idea, then write your own post from an angle we suggest.",
  },
] as const;

const NOTE = "rounded-print border-[3px] border-navy bg-paper px-4 py-3 font-medium";

export function Landing({
  isSignedIn,
  hasFailed,
  isDeleted,
}: {
  isSignedIn: boolean;
  hasFailed: boolean;
  isDeleted: boolean;
}) {
  return (
    <main className="mx-auto flex max-w-[1160px] flex-col gap-20 px-6 pt-10 pb-6">
      <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col items-start gap-6">
          <h1 className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-7xl">
            See a post you love. Make it yours.
          </h1>
          <p className="max-w-xl text-xl">
            Scroll Spark captures a post while you scroll, checks how it fits each of your channels,
            and turns it into a Buffer idea and post.
          </p>

          {hasFailed && (
            <p role="alert" className={`${NOTE} text-danger`}>
              That connection didn&apos;t finish. Nothing was saved, so you can try again.
            </p>
          )}
          {isDeleted && (
            <p role="status" className={NOTE}>
              Your data is deleted. We can&apos;t end Buffer&apos;s side of the connection for you,
              so remove Scroll Spark in your Buffer account settings too.
            </p>
          )}

          {isSignedIn ? (
            <ButtonLink href="/inbox">Open your inbox</ButtonLink>
          ) : (
            <ButtonLink href="/api/auth/connect">Connect your Buffer account</ButtonLink>
          )}
        </div>

        <CaptureToFit />
      </section>

      <section aria-labelledby="how-title" className="flex flex-col gap-6">
        <h2 id="how-title" className="font-display text-4xl font-extrabold">
          From scroll to post in three steps
        </h2>
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ title, body }, index) => (
            <li key={title} className="flex">
              <Card className="flex w-full flex-col gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-11 place-items-center rounded-full bg-navy font-display text-xl font-extrabold text-paper"
                >
                  {index + 1}
                </span>
                <h3 className="font-display text-2xl font-extrabold">{title}</h3>
                <p>{body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="extension-title">
        <Reveal>
          <Card isFeatured className="flex flex-col gap-4 md:p-8">
            <h2 id="extension-title" className="font-display text-4xl font-extrabold">
              Add the extension
            </h2>
            <p className="max-w-2xl text-lg">
              The Chrome extension is coming to the Chrome Web Store. It reads a page only after you
              ask it to, and the website works fine on its own in the meantime.
            </p>
            <p className="font-bold">Want it before then? Once a release is out:</p>
            <ol className="flex max-w-2xl list-decimal flex-col gap-1 pl-6">
              <li>
                Download the zip from{" "}
                <a
                  href={`${REPO_URL}/releases`}
                  className="font-bold text-blue underline underline-offset-4"
                >
                  GitHub releases
                </a>
                , and unzip it.
              </li>
              <li>
                Open <code className="rounded-print bg-stone px-1.5">chrome://extensions</code> and
                turn on Developer mode.
              </li>
              <li>
                Choose <b>Load unpacked</b>, then pick the unzipped folder.
              </li>
            </ol>
          </Card>
        </Reveal>
      </section>
    </main>
  );
}
