"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { appCodeOf } from "@scroll-spark/api/client";
import type { ConnectedToken, ExtensionToken } from "@scroll-spark/api/client";
import { useTRPC } from "@scroll-spark/api/react";
import { Button } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";

import { AppFrame } from "../shell/app-frame";
import { sendToExtension } from "./send-to-extension";

type Outcome = "connected" | "unreachable" | "failed" | null;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function ConnectedList({
  tokens,
  onRevoke,
  isBusy,
}: {
  tokens: ExtensionToken[];
  onRevoke: (tokenId: string) => void;
  isBusy: boolean;
}) {
  if (tokens.length === 0) {
    return <p className="font-medium">Nothing is connected yet.</p>;
  }

  return (
    <ul aria-label="Connected browsers" className="flex flex-col gap-3">
      {tokens.map(({ id, createdAt, expiresAt }) => (
        <li key={id} className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-medium">
            Connected {formatDate(createdAt)}. Expires {formatDate(expiresAt)}.
          </span>
          <Button
            variant="plain"
            disabled={isBusy}
            aria-label={`Revoke the connection from ${formatDate(createdAt)}`}
            onClick={() => {
              onRevoke(id);
            }}
          >
            Revoke
          </Button>
        </li>
      ))}
    </ul>
  );
}

function ConnectBody({ extensionId }: { extensionId: string | null }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<Outcome>(null);

  const list = useQuery(trpc.extension.list.queryOptions());
  const refreshList = () => queryClient.invalidateQueries(trpc.extension.list.queryFilter());
  const revoke = useMutation(trpc.extension.revoke.mutationOptions({ onSettled: refreshList }));
  const connect = useMutation(trpc.extension.connect.mutationOptions());

  async function deliver({ id, token, expiresAt }: ConnectedToken) {
    const isDelivered =
      extensionId !== null &&
      (await sendToExtension({
        extensionId,
        message: { type: "scroll-spark.connect", token, expiresAt },
      }));

    // A token nobody holds is only a risk, so take it back at once.
    if (!isDelivered) {
      await revoke.mutateAsync({ tokenId: id }).catch(() => undefined);
    }

    setOutcome(isDelivered ? "connected" : "unreachable");
    await refreshList();
  }

  function connectPanel() {
    setOutcome(null);

    connect.mutate(undefined, {
      onSuccess(connected) {
        void deliver(connected);
      },
      onError() {
        setOutcome("failed");
      },
    });
  }

  const hasSessionEnded = appCodeOf(list.error) === "NOT_SIGNED_IN";

  return (
    <main className="mx-auto flex max-w-[640px] flex-col gap-8 px-6 pt-10 pb-14">
      <Card isFeatured className="flex flex-col items-start gap-4">
        <h1 className="font-display text-4xl leading-10 font-extrabold tracking-tight">
          Connect the side panel
        </h1>
        <p className="font-medium">
          This lets the Scroll Spark side panel save captures to your inbox. It can&apos;t reach
          your Buffer account, and you can revoke it below at any time.
        </p>
        {extensionId === null && (
          <p role="alert" className="font-medium">
            This site isn&apos;t set up for the extension yet, so there is nothing to connect.
          </p>
        )}
        <Button disabled={extensionId === null || connect.isPending} onClick={connectPanel}>
          Connect the side panel
        </Button>
        <div role="status" className="empty:hidden">
          {outcome === "connected" && (
            <p className="font-medium">Side panel connected. You can close this tab.</p>
          )}
        </div>
        {(outcome === "unreachable" || outcome === "failed") && (
          <p role="alert" className="font-medium text-danger">
            {outcome === "unreachable"
              ? "We couldn't reach the side panel. Is the Scroll Spark extension installed in this browser? Nothing was connected."
              : "That didn't connect. Nothing was saved, so you can try again."}
          </p>
        )}
      </Card>

      <section aria-labelledby="connected-title" className="flex flex-col gap-4">
        <h2 id="connected-title" className="font-display text-2xl font-extrabold">
          Connected browsers
        </h2>
        {list.isPending && <p className="font-medium">Loading…</p>}
        {hasSessionEnded && (
          <p role="alert" className="font-medium">
            Your session has ended, so connect your Buffer account again to carry on.
          </p>
        )}
        {list.isError && !hasSessionEnded && (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="font-medium text-danger">We couldn&apos;t load your connections.</p>
            <Button
              variant="plain"
              onClick={() => {
                void list.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        )}
        {list.isSuccess && (
          <ConnectedList
            tokens={list.data}
            isBusy={revoke.isPending}
            onRevoke={(tokenId) => {
              revoke.mutate({ tokenId });
            }}
          />
        )}
        {revoke.isError && (
          <p role="alert" className="font-medium text-danger">
            That didn&apos;t revoke. Try again.
          </p>
        )}
      </section>
    </main>
  );
}

export function ExtensionConnect({ extensionId }: { extensionId: string | null }) {
  return (
    <AppFrame>
      <ConnectBody extensionId={extensionId} />
    </AppFrame>
  );
}
