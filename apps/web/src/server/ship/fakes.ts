import { AppError } from "@scroll-spark/core/errors/app-error";
import type { DraftRunLog, DraftWriter, IdeaLinks } from "@scroll-spark/core/ship/ship.service";

/** Memory only, like the other fakes: used by browser flows. */
interface MemoryStore {
  forgetUser(userId: string): void;
}

export function createMemoryIdeaLinks(): MemoryStore & IdeaLinks {
  const ideas = new Map<string, string>();
  const keyOf = (userId: string, captureId: string) => `${userId}|${captureId}`;

  return {
    forgetUser(userId) {
      for (const key of [...ideas.keys()]) {
        if (key.startsWith(`${userId}|`)) {
          ideas.delete(key);
        }
      }
    },
    find: (userId, captureId) => Promise.resolve(ideas.get(keyOf(userId, captureId)) ?? null),
    save(userId, captureId, ideaId) {
      const key = keyOf(userId, captureId);
      const saved = ideas.get(key) ?? ideaId;
      ideas.set(key, saved);

      return Promise.resolve(saved);
    },
  };
}

export function createMemoryDraftRuns(): MemoryStore & DraftRunLog {
  let runs: { userId: string; at: Date }[] = [];

  return {
    forgetUser(userId) {
      runs = runs.filter((run) => run.userId !== userId);
    },
    countSince: (userId, since) =>
      Promise.resolve(runs.filter((run) => run.userId === userId && run.at >= since).length),
    record(userId, _captureId, at) {
      runs.push({ userId, at });
      return Promise.resolve();
    },
  };
}

/** Answers without spending anything. Never sees the source text, only the brief. */
/** Writes a fixed draft. Asking for German plays a failed draft, so flows can test what follows. */
export const fakeDraftWriter: DraftWriter = {
  model: "fake-writer",
  write: ({ language }) =>
    language === "German"
      ? Promise.reject(new AppError("LLM_FAILED"))
      : Promise.resolve({
          text:
            language === "Portuguese"
              ? "Um cliente me mandou uma frase só. Mudou o que eu construí a seguir."
              : "One customer sent me a single sentence last month. It changed what I built next.",
        }),
};
