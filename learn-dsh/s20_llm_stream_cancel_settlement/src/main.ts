import {
  AssistantStreamAttempt,
  type AssistantStreamFrame,
  SessionLog,
} from "./assistant-attempt.ts";
import { FakeAdapter } from "./fake-adapter.ts";
import { LlmRuntime } from "./llm-runtime.ts";
import type { LlmFailure, TurnEndReason } from "./types.ts";

const llm = new LlmRuntime();
const release = [
  llm.registerAdapter("fake-success", new FakeAdapter("success")),
  llm.registerAdapter("fake-failure", new FakeAdapter("failure")),
  llm.registerAdapter("fake-cancel", new FakeAdapter("cancel")),
];

try {
  for (const scenario of ["success", "failure", "cancel"] as const) {
    const controller = new AbortController();
    const running = runTurn(llm, `fake-${scenario}`, controller.signal);
    if (scenario === "cancel") {
      setTimeout(() => controller.abort({ kind: "user" }), 10);
    }
    const result = await running;
    console.log(
      JSON.stringify(
        { scenario, events: result.events, frames: result.frames },
        null,
        2,
      ),
    );
  }
} finally {
  for (const dispose of release.reverse()) dispose();
}

async function runTurn(llm: LlmRuntime, provider: string, signal: AbortSignal) {
  const session = new SessionLog();
  const frames: AssistantStreamFrame[] = [];
  const attempt = new AssistantStreamAttempt(
    session,
    1,
    1,
    `session:${provider}:1`,
    (frame) => frames.push(frame),
  );
  attempt.start();

  try {
    for await (
      const chunk of llm.stream({
        provider,
        model: "fake-model",
        prompt: "继续学习",
        signal,
      })
    ) {
      // A cancellation wins over a terminal chunk delivered after the signal.
      signal.throwIfAborted();
      attempt.push(chunk);
    }

    const finish = attempt.finish;
    if (finish.kind === "error" || finish.kind === "aborted") {
      attempt.settleAttempt();
      session.append({
        type: "turn/end",
        turn: 1,
        reason: { kind: "error", error: finish.failure },
      });
    } else {
      attempt.settleMessage();
      session.append({
        type: "turn/end",
        turn: 1,
        reason: { kind: "completed" },
      });
    }
  } catch (error: unknown) {
    if (signal.aborted) {
      if (attempt.visibleText.length > 0) attempt.settleMessage(true);
      else attempt.settleAttempt();
      session.append({
        type: "turn/end",
        turn: 1,
        reason: { kind: "aborted", reason: { kind: "user" } },
      });
    } else {
      if (!attempt.ended) attempt.settleAttempt();
      const failure: LlmFailure = {
        code: "UNKNOWN",
        message: error instanceof Error ? error.message : String(error),
      };
      const reason: TurnEndReason = { kind: "error", error: failure };
      session.append({ type: "turn/end", turn: 1, reason });
    }
  }

  return { events: session.snapshot(), frames };
}
