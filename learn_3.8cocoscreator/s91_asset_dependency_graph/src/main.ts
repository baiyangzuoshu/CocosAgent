import { Asset } from "./cocos/asset/assets/asset.ts";
import { collectUuidReferences, DependencyGraph } from "./cocos/asset/asset-manager/depend-util.ts";
import { meshUuid, prefabUuid, sceneUuid, serializedMeshReference, serializedSceneReference } from "./example-dependencies.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const scene = new Asset(sceneUuid, "SceneAsset");
const soldierPrefab = new Asset(prefabUuid, "Prefab");
const soldierMesh = new Asset(meshUuid, "Mesh");
const graph = new DependencyGraph();

for (const uuid of collectUuidReferences(serializedSceneReference)) graph.add(scene.uuid, uuid);

for (const uuid of collectUuidReferences(serializedMeshReference)) graph.add(soldierPrefab.uuid, uuid);
soldierMesh.addRef();

output.textContent = [
  "Creator 3.8 Asset 依赖模型",
  ...graph.edges().map(({ owner, dependency }) => `${owner} → ${dependency}`),
  "",
  `Scene 中找到 Prefab UUID: ${collectUuidReferences(serializedSceneReference).join(", ")}`,
  `Prefab 中找到 Mesh UUID: ${collectUuidReferences(serializedMeshReference).join(", ")}`,
  `场景递归依赖: ${graph.collect(scene.uuid).join(" → ")}`,
  `Mesh Asset.refCount: ${soldierMesh.refCount}`,
  "FBX 主 UUID 与 @子 ID 组合后，指向独立 Mesh 子资源。",
].join("\n");
