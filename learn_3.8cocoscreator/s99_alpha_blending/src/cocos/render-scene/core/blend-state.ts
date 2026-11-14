export interface BlendStateDescription {
  source: "ONE" | "SRC_ALPHA";
  destination: "ONE_MINUS_SRC_ALPHA";
  premultiplied: boolean;
}
export const premultipliedBlendState: BlendStateDescription = { source: "ONE", destination: "ONE_MINUS_SRC_ALPHA", premultiplied: true };
export function applyBlendState(gl: WebGL2RenderingContext, state: BlendStateDescription): void {
  gl.enable(gl.BLEND);
  gl.blendFunc(state.source === "ONE" ? gl.ONE : gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}
export const overlap = {
  position: new Float32Array([-0.8,-0.55, 0.25,-0.55, 0.25,0.55, -0.8,-0.55, 0.25,0.55, -0.8,0.55, -0.25,-0.55, 0.8,-0.55, 0.8,0.55, -0.25,-0.55, 0.8,0.55, -0.25,0.55]),
  color: new Float32Array([0.1,0.45,1,0.55, 0.1,0.45,1,0.55, 0.1,0.45,1,0.55, 0.1,0.45,1,0.55, 0.1,0.45,1,0.55, 0.1,0.45,1,0.55, 1,0.2,0.12,0.65, 1,0.2,0.12,0.65, 1,0.2,0.12,0.65, 1,0.2,0.12,0.65, 1,0.2,0.12,0.65, 1,0.2,0.12,0.65]),
};
