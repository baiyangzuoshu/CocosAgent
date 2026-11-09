import { join } from 'node:path';
import { CURRENT_FORMAT_VERSION } from './types.ts';
import type { SessionEvent, SessionHeader, StoredSession } from './types.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHeader(value: unknown, expectedId: string): value is SessionHeader {
  return isRecord(value)
    && value.type === 'session'
    && value.version === CURRENT_FORMAT_VERSION
    && value.id === expectedId
    && typeof value.createdAt === 'number'
    && value.isSeeded === false
    && value.delegationDepth === 0;
}

function snapshotEvent(event: SessionEvent): SessionEvent {
  return Object.freeze(structuredClone(event));
}

function findLastNewline(bytes: Uint8Array): number {
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    if (bytes[index] === 0x0a) return index;
  }
  return -1;
}

function parseArtifact(bytes: Uint8Array, expectedId: string): StoredSession {
  const lastNewline = findLastNewline(bytes);
  if (lastNewline < 0) throw new Error('empty or header-less session log');

  const validBytes = lastNewline + 1;
  const lines = decoder.decode(bytes.subarray(0, validBytes)).split('\n');
  lines.pop(); // final newline terminates the last complete record
  const parsed = lines.map((line, index) => {
    try {
      return JSON.parse(line) as unknown;
    } catch (error) {
      throw new Error(`invalid JSON at line ${index + 1}`, { cause: error });
    }
  });
  const first = parsed.shift();
  if (!isHeader(first, expectedId)) throw new Error(`invalid session header for "${expectedId}"`);

  const events = parsed.map((row, index) => {
    if (!isRecord(row) || typeof row.type !== 'string' || !Number.isSafeInteger(row.seq)
      || !Number.isSafeInteger(row.time) || !Object.hasOwn(row, 'data')) {
      throw new Error(`invalid event record at line ${index + 2}`);
    }
    if (row.seq !== index) {
      throw new Error(`non-contiguous sequence at line ${index + 2}: expected ${index}, got ${String(row.seq)}`);
    }
    return snapshotEvent(row as unknown as SessionEvent);
  });

  return {
    header: first,
    events: Object.freeze(events),
    validBytes,
    tornTailBytes: bytes.length - validBytes,
  };
}

async function writeAll(file: Deno.FsFile, bytes: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < bytes.length) {
    const written = await file.write(bytes.subarray(offset));
    if (written === null || written === 0) throw new Error('file write made no progress');
    offset += written;
  }
}

export class JsonlSessionHandle {
  private closed = false;
  private materialized: boolean;
  private readonly events: SessionEvent[];

  constructor(
    private readonly store: JsonlSessionStore,
    readonly path: string,
    readonly header: SessionHeader,
    readonly access: 'read' | 'write',
    seed: readonly SessionEvent[],
    materialized: boolean,
    readonly recoveredTailBytes: number,
    private readonly releaseWriter?: () => void,
  ) {
    this.events = [...seed];
    this.materialized = materialized;
  }

  async read(): Promise<readonly SessionEvent[]> {
    this.assertOpen();
    return Object.freeze([...this.events]);
  }

  async append(batch: readonly SessionEvent[]): Promise<void> {
    this.assertWritable('append');
    if (batch.length === 0) return;
    batch.forEach((event, index) => {
      const expected = this.events.length + index;
      if (event.seq !== expected) throw new Error(`append expected seq ${expected}, got ${event.seq}`);
    });

    const snapshot = batch.map(snapshotEvent);
    await this.store.appendRows(this.path, this.header, snapshot, this.materialized);
    this.events.push(...snapshot);
    this.materialized = true;
  }

  async flush(): Promise<void> {
    this.assertWritable('flush');
    if (!this.materialized) {
      await this.store.writeHeader(this.path, this.header);
      this.materialized = true;
    }
    const file = await Deno.open(this.path, { write: true, append: true });
    try {
      await file.sync();
    } finally {
      file.close();
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    try {
      if (this.access === 'write') await this.flush();
    } finally {
      this.closed = true;
      this.releaseWriter?.();
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('session handle is closed');
  }

  private assertWritable(operation: string): void {
    this.assertOpen();
    if (this.access !== 'write') throw new Error(`read handle cannot ${operation}`);
  }
}

/** Raw JSONL demonstration of the production handle contract. */
export class JsonlSessionStore {
  private readonly writers = new Set<string>();

  constructor(private readonly root: string) {}

  pathFor(id: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('session id must be a safe path segment in this lesson');
    return join(this.root, id, 'session.v3.jsonl');
  }

  async create(header: SessionHeader): Promise<JsonlSessionHandle> {
    const path = this.pathFor(header.id);
    if (await this.fileExists(path)) throw new Error(`session "${header.id}" already exists`);
    this.claimWriter(header.id);
    return new JsonlSessionHandle(this, path, header, 'write', [], false, 0, () => this.writers.delete(header.id));
  }

  async open(id: string, access: 'read' | 'write'): Promise<JsonlSessionHandle> {
    const path = this.pathFor(id);
    const stored = parseArtifact(await Deno.readFile(path), id);
    if (access === 'write') this.claimWriter(id);

    try {
      if (access === 'write' && stored.tornTailBytes > 0) {
        const file = await Deno.open(path, { write: true });
        try {
          await file.truncate(stored.validBytes);
          await file.sync();
        } finally {
          file.close();
        }
      }
    } catch (error) {
      if (access === 'write') this.writers.delete(id);
      throw error;
    }

    return new JsonlSessionHandle(
      this,
      path,
      stored.header,
      access,
      stored.events,
      true,
      access === 'write' ? stored.tornTailBytes : 0,
      access === 'write' ? () => this.writers.delete(id) : undefined,
    );
  }

  async appendRows(
    path: string,
    header: SessionHeader,
    events: readonly SessionEvent[],
    materialized: boolean,
  ): Promise<void> {
    await Deno.mkdir(join(this.root, header.id), { recursive: true });
    const records = [
      ...(materialized ? [] : [JSON.stringify(header)]),
      ...events.map((event) => JSON.stringify(event)),
    ];
    const file = await Deno.open(path, { write: true, append: true, create: true });
    try {
      await writeAll(file, encoder.encode(`${records.join('\n')}\n`));
    } finally {
      file.close();
    }
  }

  async writeHeader(path: string, header: SessionHeader): Promise<void> {
    await Deno.mkdir(join(this.root, header.id), { recursive: true });
    const file = await Deno.open(path, { write: true, append: true, create: true });
    try {
      await writeAll(file, encoder.encode(`${JSON.stringify(header)}\n`));
    } finally {
      file.close();
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await Deno.stat(path);
      return true;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return false;
      throw error;
    }
  }

  private claimWriter(id: string): void {
    if (this.writers.has(id)) throw new Error(`session "${id}" already has a writer in this store instance`);
    this.writers.add(id);
  }
}
