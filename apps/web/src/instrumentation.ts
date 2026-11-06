/** Runs once at server startup, so bad configuration fails the deploy and not a judge's click. */
export async function register() {
  const { getEnv } = await import("./server/env");
  getEnv();
}
