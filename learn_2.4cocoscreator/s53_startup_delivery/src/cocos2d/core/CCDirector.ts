type SceneLifecycle = "created" | "loaded" | "active" | "destroyed";
export class Scene {
  lifecycle: SceneLifecycle = "created";
  readonly children: Array<{ uuid: string; name: string }> = [];
  constructor(readonly name: string) {}
  load(): void { if (this.lifecycle !== "created") throw new Error(`cannot load ${this.name} from ${this.lifecycle}`); this.lifecycle = "loaded"; }
  addChild(uuid: string, name: string): void { this.children.push({ uuid, name }); }
  activate(): void { if (this.lifecycle !== "loaded") throw new Error(`cannot activate ${this.name} before load`); this.lifecycle = "active"; }
  destroy(): void { this.children.length = 0; this.lifecycle = "destroyed"; }
}
export class CCDirector {
  private activeScene: Scene | null = null;
  private readonly persistentRoots = new Map<string, string>();
  constructor(private readonly write: (message: string) => void) {}
  addPersistRootNode(uuid: string, nodeName: string, parent: "scene-root" | "nested" = "scene-root"): void {
    if (parent !== "scene-root") throw new Error("persistent node must be a scene root");
    this.persistentRoots.set(uuid, nodeName);
  }
  runSceneImmediate(scene: Scene, onBeforeLoad?: (scene: Scene) => void, onLaunched?: (scene: Scene) => void): void {
    onBeforeLoad?.(scene);
    scene.load(); this.write(`Scene._load(${scene.name})`);
    // Real Director reattaches registered root nodes and avoids duplicate UUIDs in the destination.
    for (const [uuid, name] of this.persistentRoots) {
      const duplicate = scene.children.findIndex((child) => child.uuid === uuid);
      const persistent = { uuid, name };
      if (duplicate >= 0) scene.children.splice(duplicate, 1, persistent);
      else scene.children.push(persistent);
      this.write(`attach persistent root ${name}`);
    }
    const old = this.activeScene;
    if (old) { this.write(`AssetManager auto-release old scene refs: ${old.name} -> ${scene.name}`); old.destroy(); this.write(`destroy old scene ${old.name}`); }
    this.activeScene = null;
    scene.activate(); this.activeScene = scene;
    this.write(`activate scene ${scene.name}; emit EVENT_AFTER_SCENE_LAUNCH`);
    onLaunched?.(scene);
  }
  loadScene(name: string, onLaunched?: (scene: Scene) => void): void {
    this.write(`cc.director.loadScene(${name}): resolve SceneAsset, then runSceneImmediate`);
    this.runSceneImmediate(new Scene(name), undefined, onLaunched);
  }
  get scene(): Scene | null { return this.activeScene; }
}
