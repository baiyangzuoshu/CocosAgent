import { Mesh, type InputAssembler, type MeshData } from "./cocos2d/core/mesh/CCMesh.ts";
import { MeshRenderer } from "./cocos2d/core/mesh/CCMeshRenderer.ts";
import { RenderFlow } from "./cocos2d/core/renderer/render-flow.ts";
import type { Material } from "./cocos2d/core/renderer/renderer.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  if (output) output.textContent += values.join(" ") + "\n";
  originalLog(...values);
};

const materials: Material[] = [
  { name: "body-material", hash: 10 },
  { name: "wire-material", hash: 20 },
];
const subMeshes: InputAssembler[] = [
  { name: "body-ia", primitiveType: "triangles", indexCount: 3 },
  { name: "wire-ia", primitiveType: "lines", indexCount: 2 },
];
const subDatas: MeshData[] = [
  { canBatch: true, vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] },
  { canBatch: true, vertices: [0, 0, 0, 1, 1, 0], indices: [0, 1] },
];

const meshRenderer = new MeshRenderer(
  "mesh-node",
  new Mesh(subMeshes, subDatas),
  materials,
  1,
  true,
);
const renderFlow = new RenderFlow();
renderFlow.render(meshRenderer);
