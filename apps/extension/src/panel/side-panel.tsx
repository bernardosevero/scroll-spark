import { useState } from "react";

import { SparkMark } from "@scroll-spark/ui/spark-mark";

import type { PendingCapture } from "../capture/pending-capture";
import { isExpired } from "../lib/connect-message";
import { CaptureFlow } from "./capture-flow";
import type { PanelEnvironment } from "./environment";
import { Idle } from "./idle";
import { SignedOut } from "./signed-out";
import { readPending, readToken, useEnvironmentValue } from "./use-environment-value";

export function SidePanel({
  environment,
  webOrigin,
}: {
  environment: PanelEnvironment;
  webOrigin: string;
}) {
  const token = useEnvironmentValue(environment, readToken);
  const pending = useEnvironmentValue(environment, readPending);
  // Stored until saved, then held here, so reopening the panel can't save the same capture twice
  // while this flow carries on to its later stages.
  const [held, setHeld] = useState<PendingCapture | null>(null);
  const connectUrl = `${webOrigin}/extension/connect`;

  if (pending != null && pending.id !== held?.id) {
    setHeld(pending);
  }

  const current = pending ?? held;

  function body() {
    if (token === undefined || pending === undefined) {
      return <p className="font-medium">Loading…</p>;
    }

    if (token === null || isExpired(token)) {
      return <SignedOut connectUrl={connectUrl} />;
    }

    if (current === null) {
      return <Idle />;
    }

    return (
      <CaptureFlow
        // A new capture starts a fresh flow, so one capture's edits never leak into the next.
        key={current.id}
        pending={current}
        webOrigin={webOrigin}
        connectUrl={connectUrl}
        onSaved={() => void environment.clearPending()}
        onFinish={() => {
          setHeld(null);
          void environment.clearPending();
        }}
      />
    );
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight">
        <SparkMark size={24} />
        Scroll Spark
      </h1>
      {body()}
    </main>
  );
}
