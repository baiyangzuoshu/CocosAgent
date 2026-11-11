import { MeshRenderer, type Mesh } from "./cocos/3d/framework/mesh-renderer.ts";
import { RenderScene, Root } from "./cocos/render-scene/scene/model.ts";
import type { Material } from "./cocos/render-scene/scene/submodel.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  if (output) output.textContent += values.join(" ") + "\n";
  originalLog(...values);
};

const mesh: Mesh = {
  renderingSubMeshes: [
    { name: "body", vertexCount: 24, indexCount: 36 },
    { name: "glass", vertexCount: 8, indexCount: 12 },
  ],
};
const materials: Material[] = [
  { name: "body-material", passes: ["forward"] },
  { name: "glass-material", passes: ["forward", "shadow"] },
];

new MeshRenderer("robot-node", new Root(), new RenderScene(), mesh, materials).onEnable();
