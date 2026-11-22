type Vertex = { x: number; y: number; u: number; v: number };
type Triangle = [number, number, number];
type Point = { x: number; y: number };
function lerpVertex(a: Vertex, b: Vertex, t: number): Vertex {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t };
}
class MeshAttachment {
  constructor(readonly vertices: readonly Vertex[], readonly triangles: readonly Triangle[], readonly boneWeights: readonly number[][]) {}
  computeWorldVertices(deform: readonly Point[], boneTransforms: readonly { x: number; y: number; rotation: number; scaleX: number; scaleY: number }[]): Vertex[] {
    if (this.vertices.length !== this.boneWeights.length) throw new Error("every mesh vertex needs a bone-weight record");
    return this.vertices.map((vertex, index) => {
      const bone = boneTransforms[this.boneWeights[index][0] ?? 0];
      const delta = deform[index] ?? { x: 0, y: 0 };
      const localX = vertex.x + delta.x, localY = vertex.y + delta.y, rad = bone.rotation * Math.PI / 180;
      return { ...vertex, x: bone.x + Math.cos(rad) * localX * bone.scaleX - Math.sin(rad) * localY * bone.scaleY,
        y: bone.y + Math.sin(rad) * localX * bone.scaleX + Math.cos(rad) * localY * bone.scaleY };
    });
  }
}
type ClipPlane = { inside(v: Vertex): boolean; intersect(a: Vertex, b: Vertex): Vertex };
function clipAgainstConvexPolygon(subject: readonly Vertex[], clip: readonly Point[]): Vertex[] {
  let output = [...subject];
  const signedArea = clip.reduce((sum, p, i) => { const n = clip[(i + 1) % clip.length]; return sum + p.x * n.y - n.x * p.y; }, 0);
  const sign = Math.sign(signedArea) || 1;
  for (let edge = 0; edge < clip.length; edge++) {
    const a = clip[edge], b = clip[(edge + 1) % clip.length];
    const side = (v: Vertex): number => sign * ((b.x - a.x) * (v.y - a.y) - (b.y - a.y) * (v.x - a.x));
    const plane: ClipPlane = {
      inside: (v) => side(v) >= -1e-8,
      intersect: (start, end) => {
        const d0 = side(start), d1 = side(end);
        return lerpVertex(start, end, d0 / (d0 - d1));
      },
    };
    const input = output; output = [];
    for (let i = 0; i < input.length; i++) {
      const current = input[i], previous = input[(i + input.length - 1) % input.length];
      const inCurrent = plane.inside(current), inPrevious = plane.inside(previous);
      if (inCurrent) { if (!inPrevious) output.push(plane.intersect(previous, current)); output.push(current); }
      else if (inPrevious) output.push(plane.intersect(previous, current));
    }
  }
  return output;
}
function triangulateFan(polygon: readonly Vertex[]): { vertices: Vertex[]; triangles: number[] } {
  if (polygon.length < 3) return { vertices: [], triangles: [] };
  const vertices = [...polygon], triangles: number[] = [];
  for (let i = 1; i < polygon.length - 1; i++) triangles.push(0, i, i + 1);
  return { vertices, triangles };
}
class SkeletonClipping {
  private endSlot: string | null = null;
  begin(slot: string, clippingPolygon: readonly Point[]): void { if (clippingPolygon.length < 3) throw new Error("clip polygon requires at least 3 vertices"); this.endSlot = slot; this.polygon = clippingPolygon; }
  private polygon: readonly Point[] = [];
  clip(vertices: readonly Vertex[], indices: readonly number[]): { vertices: Vertex[]; indices: number[] } {
    const outputVertices: Vertex[] = [], outputIndices: number[] = [];
    for (let i = 0; i + 2 < indices.length; i += 3) {
      const clipped = clipAgainstConvexPolygon(indices.slice(i, i + 3).map((index) => vertices[index]), this.polygon);
      const mesh = triangulateFan(clipped), base = outputVertices.length;
      outputVertices.push(...mesh.vertices); outputIndices.push(...mesh.triangles.map((index) => index + base));
    }
    return { vertices: outputVertices, indices: outputIndices };
  }
  clipEnd(slot: string): void { if (slot === this.endSlot) { this.endSlot = null; this.polygon = []; } }
  get isClipping(): boolean { return this.endSlot !== null; }
}
export function runLesson(): string[] {
  const mesh = new MeshAttachment([
    { x: -1, y: 0, u: 0, v: 0 }, { x: 1, y: 0, u: 1, v: 0 }, { x: 1, y: 2, u: 1, v: 1 }, { x: -1, y: 2, u: 0, v: 1 },
  ], [[0, 1, 2], [0, 2, 3]], [[0], [0], [0], [0]]);
  const world = mesh.computeWorldVertices([{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0 }, { x: 0, y: 0 }], [{ x: 1, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }]);
  const clipping = new SkeletonClipping(); clipping.begin("mask-slot", [{ x: 0, y: 0 }, { x: 1.5, y: 0 }, { x: 1.5, y: 2 }, { x: 0, y: 2 }]);
  const result = clipping.clip(world, mesh.triangles.flat()); clipping.clipEnd("mask-slot");
  return [
    `deformed world vertex[1]=(${world[1].x},${world[1].y}); original indices=${mesh.triangles.flat().join(",")}`,
    `convex polygon clip: vertices=${result.vertices.length}, triangulated indices=${result.indices.join(",")}`,
    `UVs interpolated at clip intersections; clipping ended at slot => active=${clipping.isClipping}`,
    "source boundary: Creator 2.4 SkeletonClipping clips arbitrary attachment triangles and emits clipped vertices/triangles; this model handles convex clip polygons and one dominant bone per vertex, not weighted multi-bone deform or concave triangulation",
  ];
}
