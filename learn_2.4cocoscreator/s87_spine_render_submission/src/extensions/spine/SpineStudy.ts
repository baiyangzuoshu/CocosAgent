type Color = [number, number, number, number];
type SpineVertex = { x: number; y: number; u: number; v: number; light: Color; dark: Color };
type AttachmentMesh = { slot: string; texture: string; material: string; vertices: SpineVertex[]; triangles: number[]; clipped?: boolean };
type DrawBatch = { texture: string; material: string; vertices: SpineVertex[]; indices: number[]; slots: string[]; clipped: boolean };
class SpineAssemblerBuffer {
  readonly batches: DrawBatch[] = [];
  private current: DrawBatch | null = null;
  constructor(private readonly vertexCapacity: number) {}
  append(mesh: AttachmentMesh): void {
    if (!mesh.triangles.length || !mesh.vertices.length) return;
    const incompatible = this.current && (this.current.texture !== mesh.texture || this.current.material !== mesh.material);
    const overflow = this.current && this.current.vertices.length + mesh.vertices.length > this.vertexCapacity;
    if (incompatible || overflow) this.flush();
    if (!this.current) this.current = { texture: mesh.texture, material: mesh.material, vertices: [], indices: [], slots: [], clipped: false };
    const base = this.current.vertices.length;
    this.current.vertices.push(...mesh.vertices.map((vertex) => ({ ...vertex, light: [...vertex.light] as Color, dark: [...vertex.dark] as Color })));
    this.current.indices.push(...mesh.triangles.map((index) => index + base));
    this.current.slots.push(mesh.slot); this.current.clipped ||= !!mesh.clipped;
  }
  flush(): void { if (this.current?.indices.length) this.batches.push(this.current); this.current = null; }
  finish(): readonly DrawBatch[] { this.flush(); return this.batches; }
}
class SpineAssembler {
  constructor(private readonly vertexCapacity = 65532) {}
  fillBuffers(drawOrder: readonly AttachmentMesh[]): readonly DrawBatch[] {
    const buffer = new SpineAssemblerBuffer(this.vertexCapacity);
    for (const mesh of drawOrder) buffer.append(mesh); // slot order must not be reordered for alpha blending
    return buffer.finish();
  }
}
const tri = (slot: string, texture: string, x: number, color: Color, clipped = false): AttachmentMesh => ({
  slot, texture, material: "spine-premultiplied", clipped,
  vertices: [
    { x, y: 0, u: 0, v: 0, light: color, dark: [0, 0, 0, 0] },
    { x: x + 1, y: 0, u: 1, v: 0, light: color, dark: [0, 0, 0, 0] },
    { x, y: 1, u: 0, v: 1, light: color, dark: [0, 0, 0, 0] },
  ], triangles: [0, 1, 2],
});
export function runLesson(): string[] {
  const draws = [tri("body", "atlasA", 0, [1, 1, 1, 1]), tri("arm", "atlasA", 2, [1, 0.8, 0.8, 1], true), tri("weapon", "atlasB", 4, [1, 1, 1, 1])];
  const batches = new SpineAssembler(6).fillBuffers(draws);
  return [
    `input draw order=${draws.map((draw) => draw.slot).join(" -> ")}`,
    ...batches.map((batch, i) => `batch ${i}: texture=${batch.texture}; slots=${batch.slots.join("+")}; verts=${batch.vertices.length}; indices=${batch.indices.join(",")}; clipped=${batch.clipped}`),
    `first batch copied light tint=${batches[0].vertices[0].light.join(",")}; stride includes xy/uv/light/dark color fields`,
    "source boundary: spine-assembler walks Skeleton.drawOrder, handles region/mesh/clipping output, requests renderer MeshBuffer capacity, then submits batches; this model omits vertex effects, tint packing and actual WebGL upload/draw",
  ];
}
