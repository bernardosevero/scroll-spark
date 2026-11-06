// Runs before the build on Vercel. Only production migrates, so previews can't touch its data.
// A failed migration fails the build, which leaves the running deployment in place.
import { execFileSync } from "node:child_process";

if (process.env.VERCEL_ENV === "production") {
  execFileSync("pnpm", ["exec", "drizzle-kit", "migrate"], { stdio: "inherit", shell: true });
} else {
  process.stdout.write(`Skipping migrations on ${process.env.VERCEL_ENV ?? "a local build"}.\n`);
}
