"use client";

import { useState } from "react";

import { Button } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";
import { FitReveal } from "@scroll-spark/ui/fit-reveal";
import { FitRow } from "@scroll-spark/ui/fit-row";
import { IdeaFlight } from "@scroll-spark/ui/idea-flight";
import { PostLift } from "@scroll-spark/ui/post-lift";
import { Reveal } from "@scroll-spark/ui/reveal";
import { SparkBurst } from "@scroll-spark/ui/spark-burst";
import { SparkWait } from "@scroll-spark/ui/spark-wait";

/** Replays each animation on demand, since a specimen that only runs once can't be judged. */
export function MotionSpecimens() {
  const [replayCount, setReplayCount] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <Button className="self-start" onClick={() => setReplayCount((count) => count + 1)}>
        Replay
      </Button>
      <div key={replayCount} className="relative grid gap-6 sm:grid-cols-2">
        <Reveal>
          <Card>
            <b>Reveal</b>
            <p>Everyday arrival, under 300 ms.</p>
          </Card>
        </Reveal>
        <Card className="relative">
          <b>Spark burst</b>
          <p>Celebration, under 800 ms. Queued.</p>
          {replayCount > 0 && <SparkBurst />}
        </Card>
        <Card className="flex flex-col gap-3">
          <b>Fit reveal</b>
          <p>Matching posts fan out and the count ticks up, under 800 ms.</p>
          <FitReveal matchCount={3} index={0}>
            <FitRow channel="Example Studio" verdict="fits" detail="3 posts" />
          </FitReveal>
          <FitReveal matchCount={2} index={1}>
            <FitRow channel="Studio on Instagram" verdict="fits" detail="2 posts" />
          </FitReveal>
          <FitReveal matchCount={0} index={2}>
            <FitRow channel="studio.example.com" verdict="new" detail="None of your posts" />
          </FitReveal>
        </Card>
        <Card className="flex flex-col gap-3">
          <b>Waiting</b>
          <p>A turning spark. Steps tick only for what the app knows.</p>
          <SparkWait
            steps={[
              { label: "Saved to your inbox", isDone: true },
              { label: "Finding the spark…", isDone: false },
            ]}
          />
        </Card>
        <Card className="flex flex-col gap-3">
          <b>Save idea</b>
          <p>The card flies into the Ideas pile, under 800 ms.</p>
          <IdeaFlight shouldFly={replayCount > 0}>
            <p className="font-bold">Saved to Buffer Ideas</p>
          </IdeaFlight>
        </Card>
        <Card className="flex flex-col gap-3">
          <b>Capture</b>
          <p>The post lifts off the page, under 800 ms.</p>
          <div className="relative min-h-24 rounded-print border-2 border-navy p-3">
            A post worth keeping
            <PostLift isLifting={replayCount > 0} text="A post worth keeping" />
          </div>
        </Card>
      </div>
    </div>
  );
}
