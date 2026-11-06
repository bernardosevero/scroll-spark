import { Card } from "@scroll-spark/ui/card";

/** Nothing captured yet: say how, in the three ways the extension offers. */
export function Idle() {
  return (
    <Card className="flex flex-col gap-3 p-4!">
      <h2 className="font-display text-2xl leading-7 font-extrabold tracking-tight">
        Spot something good?
      </h2>
      <p className="font-medium">
        Select some text, or scroll a post to the middle of the page. Then:
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 font-medium">
        <li>click the Scroll Spark icon in the toolbar</li>
        <li>right-click and choose &ldquo;Capture with Scroll Spark&rdquo;</li>
        <li>
          press <kbd className="rounded-print border-2 border-navy bg-cream px-1.5">Alt</kbd>{" "}
          <kbd className="rounded-print border-2 border-navy bg-cream px-1.5">Shift</kbd>{" "}
          <kbd className="rounded-print border-2 border-navy bg-cream px-1.5">S</kbd>
        </li>
      </ul>
    </Card>
  );
}
