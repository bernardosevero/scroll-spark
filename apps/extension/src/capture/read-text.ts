const SKIPPED = new Set(["BUTTON", "SCRIPT", "STYLE", "SVG"]);
const BLOCKS = new Set(["P", "DIV", "LI", "UL", "OL", "BLOCKQUOTE", "H1", "H2", "H3"]);

function collect(node: Node, out: string[]) {
  if (node.nodeType === 3) {
    // Newlines in the source are only layout. Real line breaks are `<br>` and blocks.
    out.push((node.textContent ?? "").replace(/\s+/g, " "));
    return;
  }

  if (!(node instanceof Element)) {
    return;
  }

  const name = node.tagName.toUpperCase();

  if (SKIPPED.has(name)) {
    return;
  }

  if (name === "BR") {
    out.push("\n");
    return;
  }

  const isBlock = BLOCKS.has(name);
  if (isBlock) {
    out.push("\n");
  }
  node.childNodes.forEach((child) => {
    collect(child, out);
  });
  if (isBlock) {
    out.push("\n");
  }
}

/**
 * The visible words of an element, with line breaks kept and "see more" buttons left out. It
 * reads text nodes, since `innerText` depends on layout.
 */
export function readText(element: Element): string {
  const parts: string[] = [];
  collect(element, parts);

  return parts
    .join("")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
