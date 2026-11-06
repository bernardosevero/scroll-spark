import { ButtonLink } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";

/** `href` opens the website's connect page, which sends a token back to the panel. */
export function SignedOut({ connectUrl }: { connectUrl: string }) {
  return (
    <Card isFeatured className="flex flex-col items-start gap-4 p-4!">
      <h2 className="font-display text-2xl leading-7 font-extrabold tracking-tight">
        Connect to start capturing
      </h2>
      <p className="font-medium">
        Sign in on the website once, and your captures land in your inbox there.
      </p>
      <ButtonLink href={connectUrl} target="_blank" rel="noreferrer">
        Sign in on the website
      </ButtonLink>
    </Card>
  );
}
