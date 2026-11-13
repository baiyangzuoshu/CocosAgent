import { Asset } from "./cocos/asset/assets/asset.ts";
import { DependencyGraph } from "./cocos/asset/asset-manager/depend-util.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const scene = new Asset("7c3e7fab-7b1e-4865-ba84-3cf81b48b9fb", "SceneAsset");
const soldierPrefab = new Asset("cfc53c4e-7956-482b-aebc-3fb1dcd36eef", "Prefab");
const soldierMesh = new Asset("e3553cad-2f15-4293-859a-8f43c780f289@18751", "Mesh");
const graph = new DependencyGraph();
graph.add(scene.uuid, soldierPrefab.uuid);
graph.add(soldierPrefab.uuid, soldierMesh.uuid);
soldierMesh.addRef();

output.textContent = [
  "Creator 3.8 Asset 依赖模型",
  ...graph.edges().map(({ owner, dependency }) => `${owner} → ${dependency}`),
  "",
  `场景递归依赖: ${graph.collect(scene.uuid).join(" → ")}`,
  `Mesh Asset.refCount: ${soldierMesh.refCount}`,
  "FBX 主 UUID 与 @子 ID 组合后，指向独立 Mesh 子资源。",
].join("\n");
