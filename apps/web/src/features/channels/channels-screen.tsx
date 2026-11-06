"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { appCodeOf } from "@scroll-spark/api/client";
import { useTRPC } from "@scroll-spark/api/react";
import { Button, ButtonLink } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";

import { SessionOver } from "../capture/session-over";
import { AppFrame } from "../shell/app-frame";
import { ChannelPicker } from "./channel-picker";
import { OrganizationChoice } from "./organization-choice";

function LoadFailure({
  code,
  isRetrying,
  retry,
}: {
  code: string | null;
  isRetrying: boolean;
  retry: () => void;
}) {
  if (code === "NOT_SIGNED_IN") {
    return <SessionOver />;
  }

  if (code === "RECONNECT_REQUIRED") {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="font-medium text-danger">Buffer needs you to sign in again.</p>
        <ButtonLink href="/api/auth/connect" variant="plain">
          Reconnect Buffer
        </ButtonLink>
      </div>
    );
  }

  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="font-medium">We couldn&apos;t open your channels.</p>
      {code === "BUFFER_RATE_LIMITED" && (
        <p>Buffer is busy right now. Give it a few minutes, then try again.</p>
      )}
      <Button variant="plain" disabled={isRetrying} onClick={retry}>
        Try again
      </Button>
    </div>
  );
}

function ChannelsContent() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const account = useQuery(trpc.buffer.account.queryOptions());
  const setOrganization = useMutation(
    trpc.buffer.setOrganization.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.buffer.pathKey() }),
    }),
  );

  if (account.isPending) {
    return <p role="status">Opening your channels…</p>;
  }

  if (account.error !== null) {
    return (
      <LoadFailure
        code={appCodeOf(account.error)}
        isRetrying={account.isFetching}
        retry={() => {
          void account.refetch();
        }}
      />
    );
  }

  const { organizations, organizationId } = account.data;

  if (organizationId === null) {
    return (
      <OrganizationChoice
        organizations={organizations}
        isSaving={setOrganization.isPending}
        hasFailed={setOrganization.isError}
        onChoose={(id) => {
          setOrganization.mutate({ organizationId: id });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {organizations.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
          Organization
          <select
            value={organizationId}
            disabled={setOrganization.isPending}
            onChange={(event) => {
              setOrganization.mutate({ organizationId: event.target.value });
            }}
            className="min-h-11 rounded-print border-2 border-navy bg-paper px-2 font-medium"
          >
            {organizations.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
      {setOrganization.isError && (
        <p role="alert" className="font-medium text-danger">
          That didn&apos;t save, so try again.
        </p>
      )}
      <ChannelPicker key={organizationId} />
    </div>
  );
}

export function ChannelsScreen() {
  return (
    <AppFrame>
      <main className="mx-auto flex max-w-3xl flex-col items-stretch gap-6 px-6 pt-8 pb-14">
        <Card isFeatured className="flex flex-col gap-3">
          <h1 className="font-display text-4xl leading-10 font-extrabold tracking-tight">
            Your channels
          </h1>
          <p>Pick the channels we should start with when you turn a capture into a post.</p>
        </Card>
        <ChannelsContent />
      </main>
    </AppFrame>
  );
}
