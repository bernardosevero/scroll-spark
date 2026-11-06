import type { ChannelView, ChannelsView } from "./schemas";

/**
 * The channel to write for: the user's pick if it can be posted to, else their first default that
 * can, else the first channel that can. Null when none can, so hosts say so instead of guessing.
 */
export function chooseChannel(
  { channels, defaultChannelIds }: Pick<ChannelsView, "channels" | "defaultChannelIds">,
  pickedId: string | null,
): ChannelView | null {
  const supported = channels.filter(({ isSupported }) => isSupported);
  const find = (id: string | null | undefined) => supported.find((channel) => channel.id === id);

  return (
    find(pickedId) ??
    defaultChannelIds.map(find).find((channel) => channel !== undefined) ??
    supported[0] ??
    null
  );
}
