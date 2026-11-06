import { useId } from "react";

import { ChipLink } from "./chip-link";

const COUNTRIES = [
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["BR", "Brazil"],
  ["PT", "Portugal"],
  ["ES", "Spain"],
  ["MX", "Mexico"],
  ["FR", "France"],
  ["DE", "Germany"],
  ["IN", "India"],
] as const;

export interface TrendsLinksProps {
  links: { phrase: string; url: string }[];
  /** Null when there's only one phrase, so nothing to compare. */
  compareUrl: string | null;
  geo: string;
  isSaving: boolean;
  hasError: boolean;
  onGeoChange: (geo: string) => void;
}

/** Google Trends links for the user to judge demand, and the country they search in. */
export function TrendsLinks({
  links,
  compareUrl,
  geo,
  isSaving,
  hasError,
  onGeoChange,
}: TrendsLinksProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="font-display text-2xl font-extrabold">
        View on Google Trends
      </h2>
      <div className="flex flex-wrap gap-2">
        {links.map(({ phrase, url }) => (
          <ChipLink key={phrase} href={url}>
            {phrase}
          </ChipLink>
        ))}
        {compareUrl !== null && <ChipLink href={compareUrl}>Compare all</ChipLink>}
      </div>
      <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
        Country
        <select
          value={geo}
          disabled={isSaving}
          onChange={(event) => {
            onGeoChange(event.target.value);
          }}
          className="min-h-11 rounded-print border-2 border-navy bg-paper px-2 font-medium"
        >
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {hasError && (
        <p role="alert" className="font-medium text-danger">
          That country didn&apos;t save, so try again.
        </p>
      )}
    </section>
  );
}
