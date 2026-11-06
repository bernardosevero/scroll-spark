import { ButtonLink } from "@scroll-spark/ui/button";

/** Shown when a session ends while the page is open. */
export function SessionOver() {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="font-medium">Your session has ended, so connect again to carry on.</p>
      <ButtonLink href="/api/auth/connect" variant="plain">
        Connect your Buffer account
      </ButtonLink>
    </div>
  );
}
