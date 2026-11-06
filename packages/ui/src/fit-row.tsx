export interface FitRowProps {
  channel: string;
  /** "Fits" when the channel covers this topic, "New" when it doesn't. */
  verdict: "fits" | "new";
  detail: string;
}

/** One channel's answer in the fit check. Never a score: these are counts and dates. */
export function FitRow({ channel, verdict, detail }: FitRowProps) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3">
      <b>{verdict === "fits" ? `Fits ${channel}` : `New for ${channel}`}</b>
      <span>{detail}</span>
    </div>
  );
}
