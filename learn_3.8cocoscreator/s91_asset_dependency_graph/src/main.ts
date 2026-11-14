import { Asset } from "./cocos/asset/assets/asset.ts";
import { collectUuidReferences, DependencyGraph } from "./cocos/asset/asset-manager/depend-util.ts";
import { meshUuid, prefabUuid, sceneUuid, serializedMeshReference, serializedSceneReference } from "./example-dependencies.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const scene = new Asset(sceneUuid, "SceneAsset");
const soldierPrefab = new Asset(prefabUuid, "Prefab");
const graph = new DependencyGraph();

for (const uuid of collectUuidReferences(serializedSceneReference)) graph.add(scene.uuid, uuid);
for (const uuid of collectUuidReferences(serializedMeshReference)) graph.add(soldierPrefab.uuid, uuid);

const names = new Map<string, string>([
  [scene.uuid, "SceneAsset"],
  [soldierPrefab.uuid, "soldier Prefab"],
  [meshUuid, "soldier Mesh @18751"],
]);
const nameOf = (uuid: string): string => names.get(uuid) ?? uuid;

output.textContent = [
  "Creator 3.8 Asset 依赖模型",
  ...graph.edges().map(({ owner, dependency }) => nameOf(owner) + " → " + nameOf(dependency)),
  "",
  "Scene 中找到 Prefab: " + collectUuidReferences(serializedSceneReference).map(nameOf).join(", "),
  "Prefab 中找到 Mesh: " + collectUuidReferences(serializedMeshReference).map(nameOf).join(", "),
  "从 Scene 递归可达: " + [scene.uuid, ...graph.collect(scene.uuid)].map(nameOf).join(" → "),
  "先看资源名和箭头，再回 example-dependencies.ts 对照完整 UUID。",
  "完整 Mesh UUID: " + meshUuid,
].join("\n");
