import type { AssistantMessage, DerivedHistory, SessionEvent, UserMessage } from './types.ts';

const surfaceTypes = new Set(['system/message', 'developer/message', 'user/message', 'assistant/message', 'tool/result']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function activeMessage(event: SessionEvent): UserMessage | AssistantMessage | null {
  if (event.type === 'user/message' && isRecord(event.data) && event.data.role === 'user') {
    return event.data as unknown as UserMessage;
  }
  if (event.type === 'assistant/message' && isRecord(event.data) && isRecord(event.data.message)) {
    const message = event.data.message;
    if (message.role === 'assistant' && Array.isArray(message.content) && message.content.length > 0) {
      return message as unknown as AssistantMessage;
    }
  }
  // This lesson models only user and assistant messages. Other surface types
  // keep their position but are not rendered by this deliberately small demo.
  return null;
}

/** Replay append/replace markers, then derive only the active conversation. */
export function deriveHistory(events: readonly SessionEvent[]): DerivedHistory {
  const nodes: number[] = [];

  for (const [expectedSeq, event] of events.entries()) {
    if (event.seq !== expectedSeq) {
      throw new Error(`non-contiguous event log: expected seq ${expectedSeq}, got ${event.seq}`);
    }
    if (!surfaceTypes.has(event.type)) continue;

    const op = event.surfaceOp;
    if (op === undefined) throw new Error(`surface event at seq ${event.seq} has no surfaceOp`);
    if (op === 'append') {
      nodes.push(event.seq);
      continue;
    }

    const startIndex = nodes.indexOf(op.startSeq);
    const endIndex = nodes.indexOf(op.endSeq);
    if (startIndex < 0 || endIndex < startIndex) {
      throw new Error(`replace range [${op.startSeq}, ${op.endSeq}] is not on the current surface`);
    }
    const shadowed = nodes.slice(startIndex, endIndex + 1);
    const sources = new Set(event.sourceEventSeqs ?? []);
    const missing = shadowed.filter((seq) => !sources.has(seq));
    if (missing.length > 0) {
      throw new Error(`replace event at seq ${event.seq} omits shadowed source seqs: ${missing.join(', ')}`);
    }
    nodes.splice(startIndex, endIndex - startIndex + 1, event.seq);
  }

  const bySeq = new Map(events.map((event) => [event.seq, event]));
  const messages = nodes.flatMap((seq) => {
    const event = bySeq.get(seq);
    if (event === undefined) throw new Error(`surface references missing event seq ${seq}`);
    const message = activeMessage(event);
    return message === null ? [] : [message];
  });
  return { nodes: Object.freeze(nodes), messages: Object.freeze(messages) };
}
