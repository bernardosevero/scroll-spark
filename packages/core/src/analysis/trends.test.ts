import { describe, expect, it } from "vitest";

import { trendsLinks } from "./trends";

const WEB_US = { geo: "US", isYouTube: false };

describe("Google Trends links", () => {
  it("links one phrase over the last 12 months", () => {
    expect(trendsLinks(["side projects"], WEB_US)).toEqual({
      links: [
        {
          phrase: "side projects",
          url: "https://trends.google.com/trends/explore?q=side%20projects&date=today%2012-m&geo=US",
        },
      ],
      compareUrl: null,
    });
  });

  it("compares phrases with plain commas, keeping commas inside a phrase encoded", () => {
    const { compareUrl } = trendsLinks(["one", "two, too"], WEB_US);

    expect(compareUrl).toContain("?q=one,two%2C%20too&");
  });

  it("compares at most 5 phrases", () => {
    const { compareUrl, links } = trendsLinks(["a", "b", "c", "d", "e", "f"], WEB_US);

    expect(links).toHaveLength(6);
    expect(compareUrl).toContain("?q=a,b,c,d,e&");
  });

  it("uses the chosen country", () => {
    expect(trendsLinks(["a"], { ...WEB_US, geo: "BR" }).links[0]?.url).toContain("&geo=BR");
  });

  it("searches YouTube for YouTube captures only", () => {
    expect(trendsLinks(["a"], { ...WEB_US, isYouTube: true }).links[0]?.url).toContain(
      "&gprop=youtube",
    );
    expect(trendsLinks(["a"], WEB_US).links[0]?.url).not.toContain("gprop");
  });
});
