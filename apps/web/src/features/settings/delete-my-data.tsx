"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { useTRPC } from "@scroll-spark/api/react";
import { Button } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";

export function DeleteMyData() {
  const trpc = useTRPC();
  const signOut = useRef<HTMLFormElement>(null);
  const question = useRef<HTMLHeadingElement>(null);
  const [isAsking, setIsAsking] = useState(false);
  const deletion = useMutation(trpc.account.deleteMyData.mutationOptions());

  // The session cookie only clears on the server's answer to a form post, so ask for one.
  const deleteThenSignOut = () =>
    deletion.mutate(undefined, { onSuccess: () => signOut.current?.requestSubmit() });

  useEffect(() => {
    if (isAsking) {
      question.current?.focus();
    }
  }, [isAsking]);

  const isBusy = deletion.isPending || deletion.isSuccess;

  return (
    <Card isFeatured className="flex flex-col gap-4">
      <h2 className="font-display text-3xl font-extrabold">Delete my data</h2>
      <p className="max-w-2xl">
        This removes your captures, their analyses, your cached channel data and your saved Buffer
        connection from Scroll Spark, then signs you out. Ideas and posts you already sent to Buffer
        stay in Buffer.
      </p>
      <p className="max-w-2xl">
        We can&apos;t end Buffer&apos;s side of the connection for you. To stop Scroll Spark using
        your account, also remove it in your Buffer account settings.
      </p>

      {isAsking ? (
        <div role="group" aria-labelledby="delete-question" className="flex flex-col gap-3">
          <h3
            id="delete-question"
            ref={question}
            tabIndex={-1}
            className="font-display text-2xl font-extrabold"
          >
            Delete everything?
          </h3>
          <p>This can&apos;t be undone.</p>
          {deletion.isError && (
            <p role="alert" className="font-bold text-danger">
              That didn&apos;t finish, so some of your data may still be here. Try again.
            </p>
          )}
          <div className="flex flex-wrap gap-4">
            <Button disabled={isBusy} onClick={deleteThenSignOut}>
              {isBusy ? "Deleting…" : "Yes, delete my data"}
            </Button>
            <Button variant="plain" disabled={isBusy} onClick={() => setIsAsking(false)}>
              Keep my data
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button variant="plain" onClick={() => setIsAsking(true)}>
            Delete my data
          </Button>
        </div>
      )}

      <form ref={signOut} action="/api/auth/disconnect?deleted=1" method="post" hidden />
    </Card>
  );
}
