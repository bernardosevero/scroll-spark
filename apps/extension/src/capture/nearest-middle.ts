import type { PageView } from "./page-capture";

/**
 * The element on screen closest to the middle line of the viewport, or null when none is on
 * screen. An element the line passes through is distance zero, and the nearer centre breaks ties.
 */
export function nearestMiddle(elements: Element[], view: PageView): Element | null {
  const middle = view.viewportHeight / 2;
  let best: { element: Element; distance: number; offset: number } | null = null;

  for (const element of elements) {
    const { top, bottom } = view.measure(element);

    if (bottom <= 0 || top >= view.viewportHeight) {
      continue;
    }

    const distance = middle < top ? top - middle : Math.max(0, middle - bottom);
    const offset = Math.abs((top + bottom) / 2 - middle);

    if (
      best === null ||
      distance < best.distance ||
      (distance === best.distance && offset < best.offset)
    ) {
      best = { element, distance, offset };
    }
  }

  return best?.element ?? null;
}
