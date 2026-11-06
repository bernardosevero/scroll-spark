import type { ChannelView } from "@scroll-spark/api/client";

import { serviceName } from "@scroll-spark/ui/ship-messages";

/** Pick the channel to write for. Channels that can't be posted to stay visible, and say why. */
export function ChannelChoice({
  channels,
  selectedId,
  onSelect,
}: {
  channels: ChannelView[];
  selectedId: string | null;
  onSelect: (channelId: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-bold">Post to</legend>
      <ul className="flex flex-col gap-2">
        {channels.map((channel) => {
          const { id, isSupported, unsupportedReason } = channel;
          const reasonId = `ship-reason-${id}`;

          return (
            <li
              key={id}
              className={`flex flex-col gap-1 rounded-print border-[3px] border-navy p-3 ${isSupported ? "bg-paper" : "bg-stone"}`}
            >
              <label
                className={`flex min-h-11 items-center gap-3 ${isSupported ? "cursor-pointer" : "cursor-not-allowed"}`}
              >
                <input
                  type="radio"
                  name="ship-channel"
                  className="size-6 shrink-0 accent-spark"
                  checked={selectedId === id}
                  disabled={!isSupported}
                  aria-describedby={isSupported ? undefined : reasonId}
                  onChange={() => {
                    onSelect(id);
                  }}
                />
                <span className="font-medium">
                  {channel.displayName ?? channel.name}
                  <span className="font-normal"> · {serviceName(channel.service)}</span>
                </span>
              </label>
              {unsupportedReason !== null && (
                <p id={reasonId} className="text-sm">
                  {unsupportedReason}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
