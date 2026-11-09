import type { HostSession } from "./host-session.ts";

/** The current Harness Gateway's browser WebSocket upgrade path. */
export const REMOTE_MUX_PATH = "/api/remote.mux";

/** In-process carrier that still serializes each frame across a JSON wire seam. */
export class LocalRemoteMux {
  async *openSessionFollow(
    session: HostSession,
    signal: AbortSignal,
  ): AsyncIterable<string> {
    for await (const frame of session.follow(signal)) {
      yield JSON.stringify(frame);
    }
  }
}
