export const attributeRoles = [
  { name: "a_position", meaning: "vertex position" },
  { name: "a_uv", meaning: "texture coordinate" },
  { name: "a_color", meaning: "vertex tint" },
];
export const vertexData = {
  position: new Float32Array([-0.7,-0.6, 0.7,-0.6, 0.0,0.7]),
  uv: new Float32Array([0,0, 1,0, 0.5,1]),
  color: new Float32Array([1,0.2,0.2,1, 0.2,1,0.2,1, 0.2,0.4,1,1]),
  mvp: new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0.2,0,0,1]),
};
