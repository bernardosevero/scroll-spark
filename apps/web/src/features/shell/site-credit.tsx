/**
 * Drawn rather than the 🇧🇷 emoji, because Windows has no flag emoji and would show the letters "BR".
 */
function BrazilFlag() {
  return (
    <svg
      role="img"
      aria-label="Brazil"
      viewBox="0 0 20 14"
      width="20"
      height="14"
      className="inline-block rounded-[2px] align-[-1px]"
    >
      <rect width="20" height="14" fill="#009c3b" />
      <path d="M10 1.6 18.2 7 10 12.4 1.8 7z" fill="#ffdf00" />
      <circle cx="10" cy="7" r="3.1" fill="#002776" />
    </svg>
  );
}

/** The maker's credit line, the same on every page and on the owner's other sites. */
export function SiteCredit() {
  return (
    <p className="font-medium">
      © Bernardo Severo - 2026 | Made with{" "}
      <span className="whitespace-nowrap">
        <span role="img" aria-label="love">
          ❤️
        </span>{" "}
        in <BrazilFlag />
      </span>
    </p>
  );
}
