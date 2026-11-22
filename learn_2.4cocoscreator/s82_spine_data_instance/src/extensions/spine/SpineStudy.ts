type BoneSetup = { name: string; parent: number; x: number; y: number };
class SkeletonData {
  private parsed: { bones: readonly BoneSetup[]; skins: readonly string[] } | null = null;
  constructor(readonly uuid: string, private readonly raw: { bones: BoneSetup[]; skins: string[] }, readonly atlasPages: readonly string[]) {}
  parseOnce(): { bones: readonly BoneSetup[]; skins: readonly string[] } {
    if (!this.parsed) this.parsed = { bones: this.raw.bones.map((bone) => Object.freeze({ ...bone })), skins: [...this.raw.skins] };
    return this.parsed;
  }
}
type BonePose = { x: number; y: number; worldX: number; worldY: number };
type CacheFrame = { time: number; vertices: number[] };
class SkeletonInstance {
  readonly template: ReturnType<SkeletonData["parseOnce"]>;
  readonly bones: BonePose[];
  readonly attachments = new Map<string, string>();
  readonly renderVertices: number[] = [];
  readonly cacheFrames: CacheFrame[] = [];
  constructor(readonly data: SkeletonData, readonly cacheMode: "REALTIME" | "SHARED_CACHE" | "PRIVATE_CACHE") {
    this.template = data.parseOnce();
    // Each runtime Skeleton owns its pose and slot state even when setup data is shared.
    this.bones = this.template.bones.map((bone) => ({ x: bone.x, y: bone.y, worldX: 0, worldY: 0 }));
  }
  setBone(name: string, x: number, y: number): void {
    const index = this.template.bones.findIndex((bone) => bone.name === name);
    if (index < 0) throw new Error(`unknown bone ${name}`);
    this.bones[index].x = x; this.bones[index].y = y;
  }
  updateWorldPose(): void {
    for (let i = 0; i < this.bones.length; i++) {
      const parent = this.template.bones[i].parent;
      const bone = this.bones[i];
      bone.worldX = (parent >= 0 ? this.bones[parent].worldX : 0) + bone.x;
      bone.worldY = (parent >= 0 ? this.bones[parent].worldY : 0) + bone.y;
    }
  }
}
class SkeletonCacheOwnership {
  private readonly references = new Map<string, number>();
  retain(uuid: string): void { this.references.set(uuid, (this.references.get(uuid) ?? 0) + 1); }
  release(uuid: string): number { const count = Math.max(0, (this.references.get(uuid) ?? 0) - 1); this.references.set(uuid, count); return count; }
  count(uuid: string): number { return this.references.get(uuid) ?? 0; }
}
export function runLesson(): string[] {
  const data = new SkeletonData("hero-data", { bones: [{ name: "root", parent: -1, x: 0, y: 0 }, { name: "arm", parent: 0, x: 2, y: 1 }], skins: ["default", "winter"] }, ["hero.atlas.png"]);
  const refs = new SkeletonCacheOwnership();
  const first = new SkeletonInstance(data, "REALTIME"), second = new SkeletonInstance(data, "REALTIME");
  refs.retain(data.uuid); refs.retain(data.uuid);
  first.setBone("arm", 7, 1); first.updateWorldPose(); second.updateWorldPose();
  first.renderVertices.push(0, 1, 2);
  return [
    `parsed SkeletonData shared=${first.template === second.template}; atlas pages shared=${first.data.atlasPages === second.data.atlasPages}`,
    `runtime Skeleton objects independent=${first !== second}; arm worldX=${first.bones[1].worldX}/${second.bones[1].worldX}`,
    `slot/render storage independent=${first.attachments !== second.attachments && first.renderVertices !== second.renderVertices}`,
    `component references=${refs.count(data.uuid)}; after one component releases=${refs.release(data.uuid)}`,
    "source boundary: SkeletonData/Atlas are asset-level inputs; each realtime component constructs a Spine Skeleton/AnimationState. SHARED_CACHE and PRIVATE_CACHE route through SkeletonCache with different ownership scopes.",
  ];
}
