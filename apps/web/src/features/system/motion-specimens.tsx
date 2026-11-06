"use client";

import { useState } from "react";

import { Button } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";
import { Reveal } from "@scroll-spark/ui/reveal";
import { SparkBurst } from "@scroll-spark/ui/spark-burst";

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
          <p>Celebration, under 800 ms.</p>
          {replayCount > 0 && <SparkBurst />}
        </Card>
      </div>
    </div>
  );
}
