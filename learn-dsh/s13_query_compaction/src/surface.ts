import type { Message, SessionEvent, SurfaceFold } from './types.ts';

const surfaceTypes = new Set(['system/message', 'developer/message', 'user/message', 'assistant/message', 'tool/result']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function foldSurface(events: readonly SessionEvent[]): SurfaceFold {
  const nodes: number[] = [];
  const replacements: Array<{ seq: number; shadowedSeqs: number[] }> = [];

  for (const [expectedSeq, event] of events.entries()) {
    if (event.seq !== expectedSeq) throw new Error(`expected event seq ${expectedSeq}, got ${event.seq}`);
    if (!surfaceTypes.has(event.type)) continue;

    const op = event.surfaceOp;
    if (op === undefined) throw new Error(`surface event ${event.seq} has no surfaceOp`);
    if (op === 'append') {
      nodes.push(event.seq);
      continue;
    }

    const startIndex = nodes.indexOf(op.startSeq);
    const endIndex = nodes.indexOf(op.endSeq);
    if (startIndex < 0 || endIndex < startIndex) throw new Error('replace range is not on the current surface');
    const shadowedSeqs = nodes.slice(startIndex, endIndex + 1);
    const sources = new Set(event.sourceEventSeqs ?? []);
    if (shadowedSeqs.some((seq) => !sources.has(seq))) {
      throw new Error('replacement must cite every shadowed surface event');
    }
    nodes.splice(startIndex, endIndex - startIndex + 1, event.seq);
    replacements.push({ seq: event.seq, shadowedSeqs });
  }

  return { nodes: Object.freeze(nodes), replacements: Object.freeze(replacements) };
}

export function deriveEventMessage(event: SessionEvent): Message | null {
  if (!isRecord(event.data)) return null;
  const rawMessage = event.type === 'user/message'
    ? event.data
    : isRecord(event.data.message) ? event.data.message : undefined;
  if (!isRecord(rawMessage) || typeof rawMessage.role !== 'string' || !Array.isArray(rawMessage.content)) return null;
  const content = rawMessage.content.filter((block): block is { type: 'text'; text: string } =>
    isRecord(block) && block.type === 'text' && typeof block.text === 'string'
  );
  if (content.length === 0 && ['system/message', 'developer/message', 'assistant/message'].includes(event.type)) return null;
  return { role: rawMessage.role, content };
}

export function messageText(message: Message): string {
  return message.content.map((block) => block.text).join('\n');
}

export function surfaceStatuses(events: readonly SessionEvent[]): Map<number, 'current' | 'shadowed' | 'log-only'> {
  const folded = foldSurface(events);
  const statuses = new Map<number, 'current' | 'shadowed' | 'log-only'>();
  for (const replacement of folded.replacements) {
    for (const seq of replacement.shadowedSeqs) statuses.set(seq, 'shadowed');
  }
  for (const seq of folded.nodes) statuses.set(seq, 'current');
  return statuses;
}
