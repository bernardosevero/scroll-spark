import { ButtonLink } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";

/** The side panel opens this page, so someone who isn't signed in yet lands here first. */
export function ExtensionSignedOut() {
  return (
    <main className="mx-auto flex max-w-[640px] flex-col px-6 pt-10 pb-14">
      <Card isFeatured className="flex flex-col items-start gap-4">
        <h1 className="font-display text-4xl leading-10 font-extrabold tracking-tight">
          Connect the side panel
        </h1>
        <p className="font-medium">
          Connect your Buffer account first. Then open this page again from the side panel.
        </p>
        <ButtonLink href="/api/auth/connect">Connect your Buffer account</ButtonLink>
        <p className="text-sm">Built on the Buffer API.</p>
      </Card>
    </main>
  );
}
