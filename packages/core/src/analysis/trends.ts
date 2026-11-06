const EXPLORE = "https://trends.google.com/trends/explore";
const MAX_COMPARED = 5;

function exploreUrl(phrases: string[], { geo, isYouTube }: TrendsOptions) {
  const query = phrases.map(encodeURIComponent).join(",");
  const youtube = isYouTube ? "&gprop=youtube" : "";

  return `${EXPLORE}?q=${query}&date=today%2012-m&geo=${encodeURIComponent(geo)}${youtube}`;
}

interface TrendsOptions {
  geo: string;
  /** Searches YouTube rather than the web, for captures that came from there. */
  isYouTube: boolean;
}

/** Links only: people judge demand for themselves, and we never calculate it. */
export function trendsLinks(phrases: string[], options: TrendsOptions) {
  return {
    links: phrases.map((phrase) => ({ phrase, url: exploreUrl([phrase], options) })),
    compareUrl: phrases.length > 1 ? exploreUrl(phrases.slice(0, MAX_COMPARED), options) : null,
  };
}
