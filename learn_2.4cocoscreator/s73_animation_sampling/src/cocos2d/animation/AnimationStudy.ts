type Key = { time: number; value: number; curve?: "linear" | "step" | "smooth" };
type Vec2 = { x: number; y: number };
class AnimationCurve {
  constructor(readonly keys: readonly Key[]) {
    if (keys.length < 1 || keys.some((key, i) => i > 0 && key.time <= keys[i - 1].time)) throw new Error("curve key times must increase");
  }
  sample(time: number): number {
    if (time <= this.keys[0].time) return this.keys[0].value;
    const last = this.keys[this.keys.length - 1];
    if (time >= last.time) return last.value;
    let low = 0, high = this.keys.length - 1;
    while (low + 1 < high) { const middle = (low + high) >> 1; if (this.keys[middle].time <= time) low = middle; else high = middle; }
    const left = this.keys[low], right = this.keys[high];
    if (left.curve === "step") return left.value;
    let ratio = (time - left.time) / (right.time - left.time);
    if (left.curve === "smooth") ratio = ratio * ratio * (3 - 2 * ratio);
    return left.value + (right.value - left.value) * ratio;
  }
}
type Binding = { path: string; property: string; curve: AnimationCurve };
class NodeTarget {
  position: Vec2 = { x: 0, y: 0 };
  opacity = 255;
  constructor(readonly name: string) {}
  setProperty(path: string, property: string, value: number): void {
    if (path !== this.name) throw new Error(`unresolved animation path: ${path}`);
    if (property === "position.x") this.position.x = value;
    else if (property === "position.y") this.position.y = value;
    else if (property === "opacity") this.opacity = value;
    else throw new Error(`unsupported property binding: ${property}`);
  }
}
class AnimationState {
  constructor(readonly bindings: readonly Binding[], readonly root: NodeTarget) {}
  sample(time: number): Array<{ property: string; value: number }> {
    const writes = this.bindings.map((binding) => ({ property: binding.property, value: binding.curve.sample(time) }));
    for (let i = 0; i < writes.length; i++) this.root.setProperty(this.bindings[i].path, writes[i].property, writes[i].value);
    return writes;
  }
}
export function runLesson(): string[] {
  const target = new NodeTarget("Player");
  const state = new AnimationState([
    { path: "Player", property: "position.x", curve: new AnimationCurve([{ time: 0, value: 0 }, { time: 0.5, value: 10, curve: "smooth" }, { time: 1, value: 20 }]) },
    { path: "Player", property: "opacity", curve: new AnimationCurve([{ time: 0, value: 255 }, { time: 1, value: 0, curve: "step" }]) },
  ], target);
  const writes = state.sample(0.75);
  return [
    `sample at t=0.75s -> ${writes.map((write) => `${write.property}=${write.value.toFixed(2)}`).join(", ")}`,
    `property writes -> position.x=${target.position.x.toFixed(2)}, opacity=${target.opacity}`,
    "curve lookup uses binary search; interpolation mode belongs to the left key segment",
    "source boundary: engine curves bind serialized paths to target objects and write typed values; this model supports scalar properties only (not quaternion/color/array curves)",
  ];
}
