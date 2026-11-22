type KeyValue = number | string;
type Key = { frame: number; value: KeyValue };
type PropertyTrack = { path: string; property: string; keys: readonly Key[] };

/** Runtime clip data is immutable input; AnimationState creates instance-specific playback state. */
class AnimationClip {
  constructor(readonly name: string, readonly duration: number, readonly sampleRate: number,
    readonly tracks: readonly PropertyTrack[], readonly events: readonly { frame: number; func: string; params: unknown[] }[] = []) {
    if (!name || duration <= 0 || sampleRate <= 0) throw new Error("clip requires name, positive duration and sample rate");
    for (const track of tracks) {
      if (!track.path || track.keys.length === 0) throw new Error(`empty property track: ${track.path}.${track.property}`);
      let previous = -1;
      for (const key of track.keys) {
        if (key.frame < previous || key.frame > duration * sampleRate) throw new Error(`invalid key time in ${track.path}.${track.property}`);
        previous = key.frame;
      }
    }
  }
  get frameCount(): number { return Math.ceil(this.duration * this.sampleRate); }
  get tracksByPath(): Map<string, PropertyTrack[]> {
    const map = new Map<string, PropertyTrack[]>();
    for (const track of this.tracks) map.set(track.path, [...(map.get(track.path) ?? []), track]);
    return map;
  }
  createState(rootName: string): AnimationState { return new AnimationState(this, rootName); }
}

class AnimationState {
  time = 0;
  playing = false;
  readonly bindings: Array<{ target: string; property: string; first: KeyValue; last: KeyValue }> = [];
  constructor(readonly clip: AnimationClip, readonly rootName: string) {
    // Animator resolves each curve path against the root node/component tree.
    for (const track of clip.tracks) {
      this.bindings.push({ target: `${rootName}/${track.path}`, property: track.property,
        first: track.keys[0].value, last: track.keys[track.keys.length - 1].value });
    }
  }
  play(): void { this.playing = true; }
  stop(): void { this.playing = false; this.time = 0; }
}

class CCAnimation {
  private readonly clips = new Map<string, AnimationClip>();
  private readonly states = new Map<string, AnimationState>();
  addClip(clip: AnimationClip): void { this.clips.set(clip.name, clip); }
  removeClip(name: string): void { this.clips.delete(name); this.states.delete(name); }
  createState(name: string, root: string): AnimationState {
    const clip = this.clips.get(name);
    if (!clip) throw new Error(`unknown clip: ${name}`);
    const state = clip.createState(root);
    this.states.set(name, state);
    return state;
  }
  getClip(name: string): AnimationClip | undefined { return this.clips.get(name); }
}

export function runLesson(): string[] {
  const clip = new AnimationClip("move", 1, 30, [
    { path: "Player", property: "position.x", keys: [{ frame: 0, value: 0 }, { frame: 15, value: 80 }, { frame: 30, value: 120 }] },
    { path: "Sprite", property: "color", keys: [{ frame: 0, value: "white" }, { frame: 30, value: "red" }] },
  ], [{ frame: 12, func: "step", params: ["left"] }]);
  const animation = new CCAnimation(); animation.addClip(clip);
  const state = animation.createState("move", "Scene/Actor"); state.play();
  return [
    `clip=${clip.name}; duration=${clip.duration}s; sampleRate=${clip.sampleRate}; frameCount=${clip.frameCount}`,
    `curve count=${clip.tracks.length}; paths=${[...clip.tracksByPath.keys()].join(", ")}`,
    ...state.bindings.map((binding) => `bound ${binding.target}.${binding.property}: ${binding.first} -> ${binding.last}`),
    `event keys are clip data too: ${clip.events.map((event) => `${event.func}@${event.frame}`).join(", ")}`,
    "source boundary: actual clip deserialization creates curves from serialized curves; this model uses explicit property-track records",
  ];
}
