type ContactFilter = { group: number; mask: number; isTrigger: boolean };
type ContactKind = "collision-enter" | "collision-stay" | "collision-exit" | "trigger-enter" | "trigger-stay" | "trigger-exit";
type ContactListener = (other: string, kind: ContactKind) => void;
class Collider3D {
  private readonly listeners = new Set<ContactListener>();
  constructor(readonly name: string, readonly filter: ContactFilter) {}
  onContact(listener: ContactListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(other: Collider3D, kind: ContactKind): void { for (const listener of this.listeners) listener(other.name, kind); }
}
type PairRecord = { a: Collider3D; b: Collider3D; trigger: boolean };
const pairKey = (a: Collider3D, b: Collider3D): string => [a.name, b.name].sort().join("::");
function filtersPass(a: ContactFilter, b: ContactFilter): boolean {
  return (a.group & b.mask) !== 0 && (b.group & a.mask) !== 0;
}
/** Converts backend overlap snapshots into component enter/stay/exit events. */
class ContactEventBridge {
  private active = new Map<string, PairRecord>();
  update(overlaps: Array<[Collider3D, Collider3D]>): string[] {
    const next = new Map<string, PairRecord>();
    for (const [a, b] of overlaps) {
      if (!filtersPass(a.filter, b.filter)) continue;
      const key = pairKey(a, b);
      const trigger = a.filter.isTrigger || b.filter.isTrigger;
      next.set(key, { a, b, trigger });
    }
    const log: string[] = [];
    for (const [key, pair] of next) {
      const wasActive = this.active.has(key);
      const kind = `${pair.trigger ? "trigger" : "collision"}-${wasActive ? "stay" : "enter"}` as ContactKind;
      pair.a.emit(pair.b, kind); pair.b.emit(pair.a, kind);
      log.push(`${key}: ${kind}`);
    }
    for (const [key, pair] of this.active) {
      if (next.has(key)) continue;
      const kind = `${pair.trigger ? "trigger" : "collision"}-exit` as ContactKind;
      pair.a.emit(pair.b, kind); pair.b.emit(pair.a, kind);
      log.push(`${key}: ${kind}`);
    }
    this.active = next;
    return log;
  }
}

export function runLesson(): string[] {
  const log: string[] = [];
  const player = new Collider3D("Player", { group: 1 << 0, mask: (1 << 1) | (1 << 2), isTrigger: false });
  const sensor = new Collider3D("Sensor", { group: 1 << 1, mask: 1 << 0, isTrigger: true });
  const wall = new Collider3D("Wall", { group: 1 << 3, mask: 1 << 3, isTrigger: false });
  for (const collider of [player, sensor, wall]) collider.onContact((other, kind) => log.push(`${collider.name}.emit(${kind}, other=${other})`));
  const bridge = new ContactEventBridge();
  log.push(...bridge.update([[player, sensor], [player, wall]])); // wall rejected by bilateral mask test
  log.push(...bridge.update([[player, sensor]]));
  log.push(...bridge.update([]));
  return ["pair survives only if both (group & other.mask) checks pass", ...log];
}
