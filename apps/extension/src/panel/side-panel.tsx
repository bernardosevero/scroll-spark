import { SparkMark } from "@scroll-spark/ui/spark-mark";

import { isExpired } from "../lib/connect-message";
import type { PanelEnvironment } from "./environment";
import { ReviewForm } from "./review-form";
import { SignedOut } from "./signed-out";
import { readPending, readToken, useEnvironmentValue } from "./use-environment-value";
import { Waiting } from "./waiting";

export function SidePanel({
  environment,
  webOrigin,
}: {
  environment: PanelEnvironment;
  webOrigin: string;
}) {
  const token = useEnvironmentValue(environment, readToken);
  const pending = useEnvironmentValue(environment, readPending);
  const connectUrl = `${webOrigin}/extension/connect`;

  function body() {
    if (token === undefined || pending === undefined) {
      return <p className="font-medium">Loading…</p>;
    }

    if (token === null || isExpired(token)) {
      return <SignedOut connectUrl={connectUrl} />;
    }

    if (pending === null) {
      return <Waiting />;
    }

    return (
      <ReviewForm
        // A new capture starts a fresh form, so one capture's edits never leak into the next.
        key={pending.id}
        pending={pending}
        webOrigin={webOrigin}
        connectUrl={connectUrl}
        onFinish={() => void environment.clearPending()}
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
