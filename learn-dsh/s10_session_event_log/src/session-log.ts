import type { EventInput, JsonValue, SessionEvent } from './types.ts';

const surfaceEventTypes = new Set([
  'system/message',
  'developer/message',
  'user/message',
  'assistant/message',
  'tool/result',
]);

function snapshotJson(
  value: unknown,
  ancestors: WeakSet<object> = new WeakSet(),
  path = '$',
): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw new TypeError(`non-JSON number at ${path}`);
    }
    return value;
  }
  if (typeof value !== 'object') throw new TypeError(`non-JSON value at ${path}`);
  if (ancestors.has(value)) throw new TypeError(`circular value at ${path}`);

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const result: JsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) throw new TypeError(`sparse array at ${path}[${index}]`);
        result.push(snapshotJson(value[index], ancestors, `${path}[${index}]`));
      }
      return result;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`non-plain object at ${path}`);
    }
    if (Reflect.ownKeys(value).some((key) => typeof key !== 'string')) {
      throw new TypeError(`symbol key at ${path}`);
    }

    const result: Record<string, JsonValue> = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = snapshotJson(child, ancestors, `${path}.${key}`);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

function freezeJson<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) {
    for (const child of value) freezeJson(child);
  } else if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeJson(child);
  }
  return Object.freeze(value);
}

export class SessionLog {
  private readonly events: SessionEvent[] = [];

  get seq(): number {
    return this.events.length;
  }

  append(input: EventInput): SessionEvent {
    const isSurfaceEvent = surfaceEventTypes.has(input.type);
    if (isSurfaceEvent && input.surfaceOp !== 'append') {
      throw new Error(`surface event "${input.type}" requires surfaceOp: append`);
    }
    if (!isSurfaceEvent && input.surfaceOp !== undefined) {
      throw new Error(`log-only event "${input.type}" cannot carry surfaceOp`);
    }

    const data = freezeJson(snapshotJson(input.data));
    const event = Object.freeze({
      type: input.type,
      seq: this.events.length,
      time: 1_700_000_000_000 + this.events.length,
      data,
      ...(input.surfaceOp === undefined ? {} : { surfaceOp: input.surfaceOp }),
    });
    this.events.push(event);
    return event;
  }

  read(fromSeq = 0, toSeqExclusive = this.seq): readonly SessionEvent[] {
    if (!Number.isSafeInteger(fromSeq) || !Number.isSafeInteger(toSeqExclusive)) {
      throw new RangeError('event range must use safe integer offsets');
    }
    if (fromSeq < 0 || fromSeq > toSeqExclusive || toSeqExclusive > this.seq) {
      throw new RangeError(`invalid event range [${fromSeq}, ${toSeqExclusive}) at seq ${this.seq}`);
    }
    return Object.freeze(this.events.slice(fromSeq, toSeqExclusive));
  }
}
