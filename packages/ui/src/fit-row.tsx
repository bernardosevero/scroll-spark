export interface FitRowProps {
  channel: string;
  /**
   * "fits" when the channel covers this topic, "new" when it doesn't, and "unclear" when there
   * isn't enough history to say.
   */
  verdict: "fits" | "new" | "unclear";
  detail: string;
}

function headline(channel: string, verdict: FitRowProps["verdict"]) {
  switch (verdict) {
    case "fits":
      return `Fits ${channel}`;
    case "new":
      return `New for ${channel}`;
    case "unclear":
      return channel;
  }
}

/** One channel's answer in the fit check. Never a score: these are counts and dates. */
export function FitRow({ channel, verdict, detail }: FitRowProps) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3">
      <b>{headline(channel, verdict)}</b>
      <span>{detail}</span>
    </div>
  );
}
