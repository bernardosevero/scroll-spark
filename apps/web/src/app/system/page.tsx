import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Button } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";
import { ChipButton } from "@scroll-spark/ui/chip-button";
import { ChipLink } from "@scroll-spark/ui/chip-link";
import { FitRow } from "@scroll-spark/ui/fit-row";
import { SparkMark } from "@scroll-spark/ui/spark-mark";
import { TextAreaField } from "@scroll-spark/ui/text-area-field";

import { MotionSpecimens } from "@/features/system/motion-specimens";

export const metadata: Metadata = { title: "Riso Print design system" };

const COLOURS = [
  { name: "cream", role: "Page background", fill: "bg-cream text-navy" },
  { name: "stone", role: "Quiet surfaces", fill: "bg-stone text-navy" },
  { name: "paper", role: "Cards and fields", fill: "bg-paper text-navy" },
  { name: "navy", role: "Text and outlines", fill: "bg-navy text-paper" },
  { name: "spark", role: "The main action, joy", fill: "bg-spark text-paper" },
  { name: "blue", role: "Links, focus rings", fill: "bg-blue text-paper" },
  { name: "danger", role: "Problems only", fill: "bg-danger text-paper" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="font-display text-3xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

export default function SystemPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-14 px-6 py-14">
      <header className="flex items-start justify-between gap-6">
        <h1 className="font-display text-6xl leading-none font-extrabold tracking-tight">
          Riso Print
        </h1>
        <SparkMark size={88} />
      </header>

      <Section title="Colour">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
          {COLOURS.map(({ name, role, fill }) => (
            <div key={name} className={`rounded-print border-[3px] border-navy p-4 ${fill}`}>
              <b className="block">{name}</b>
              <span>{role}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <p className="font-display text-6xl leading-none font-extrabold tracking-tight">
          This one has a spark.
        </p>
        <p className="font-display text-2xl font-extrabold">Bricolage Grotesque, for headings.</p>
        <p>DM Sans, for everything you read and every label you act on.</p>
      </Section>

      <Section title="Actions">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Save as draft</Button>
          <Button variant="plain">Add to LinkedIn queue</Button>
          <Button disabled>Not available</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <ChipLink href="https://trends.google.com/trends/explore?q=side%20projects">
            side projects
          </ChipLink>
          <ChipLink href="https://trends.google.com/trends/explore?q=build%20in%20public">
            build in public
          </ChipLink>
          <ChipButton>A founder story</ChipButton>
        </div>
      </Section>

      <Section title="Surfaces">
        <Card isFeatured className="flex flex-col gap-3">
          <b className="font-display text-2xl font-extrabold">
            What building a small study app taught you about finishing things
          </b>
          <FitRow channel="LinkedIn" verdict="fits" detail="2 posts, last on Sep 29" />
          <FitRow channel="G(Old) Times" verdict="new" detail="No posts on this yet" />
        </Card>
        <TextAreaField label="Captured text" defaultValue="Paste or capture a post, then fix it." />
      </Section>

      <Section title="Motion">
        <MotionSpecimens />
      </Section>
    </main>
  );
}
