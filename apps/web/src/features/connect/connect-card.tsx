import { Button, ButtonLink } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";

export function ConnectCard({
  isConnected,
  hasFailed,
}: {
  isConnected: boolean;
  hasFailed: boolean;
}) {
  if (isConnected) {
    return (
      <Card isFeatured className="flex flex-col items-start gap-4">
        <p className="font-medium">Your Buffer account is connected.</p>
        <form action="/api/auth/disconnect" method="post">
          <Button type="submit" variant="plain">
            Sign out
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card isFeatured className="flex flex-col items-start gap-4">
      <p className="font-medium">Capture a post you like, and turn it into your next post.</p>
      {hasFailed && (
        <p role="alert" className="font-medium text-danger">
          That connection didn&apos;t finish. Nothing was saved, so you can try again.
        </p>
      )}
      <ButtonLink href="/api/auth/connect">Connect your Buffer account</ButtonLink>
      <p className="text-sm">Built on the Buffer API.</p>
    </Card>
  );
}
