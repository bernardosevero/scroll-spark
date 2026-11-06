import { ButtonLink } from "@scroll-spark/ui/button";

/**
 * An expected failure, in its own words, with the way forward when there is one on the website:
 * sign in again, reconnect Buffer, or choose where to save. The panel never offers to retry here.
 */
export function Failure({
  code,
  message,
  webOrigin,
  connectUrl,
  chooseChannelsLink = false,
}: {
  code: string | null;
  message: string;
  webOrigin: string;
  connectUrl: string;
  /** Adds a link to the website's channels page, for failures that need an organization. */
  chooseChannelsLink?: boolean;
}) {
  if (code === "NOT_SIGNED_IN") {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="font-medium">
          Your sign-in has ended. Sign in again, and your text will still be here.
        </p>
        <ButtonLink href={connectUrl} target="_blank" rel="noreferrer" variant="plain">
          Sign in on the website
        </ButtonLink>
      </div>
    );
  }

  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="font-medium text-danger">{message}</p>
      {code === "RECONNECT_REQUIRED" && (
        <ButtonLink
          href={`${webOrigin}/api/auth/connect`}
          target="_blank"
          rel="noreferrer"
          variant="plain"
        >
          Reconnect Buffer
        </ButtonLink>
      )}
      {chooseChannelsLink && (
        <ButtonLink href={`${webOrigin}/channels`} target="_blank" rel="noreferrer" variant="plain">
          Choose your channels
        </ButtonLink>
      )}
    </div>
  );
}
