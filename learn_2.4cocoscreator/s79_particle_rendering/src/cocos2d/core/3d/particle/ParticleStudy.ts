type Particle = { id: number; x: number; y: number; depth: number; size: number; rotation: number; color: [number, number, number, number]; material: string; visible: boolean };
type Vertex = { x: number; y: number; u: number; v: number; color: Particle["color"] };
type Batch = { material: string; vertices: Vertex[]; indices: number[]; particleIds: number[] };
class ParticleBatchModel {
  readonly batches: Batch[] = [];
  private current: Batch | null = null;
  constructor(private readonly maxVertices = 65532) {}
  append(material: string, particle: Particle, vertices: Vertex[]): void {
    if (!this.current || this.current.material !== material || this.current.vertices.length + vertices.length > this.maxVertices) {
      this.flush(); this.current = { material, vertices: [], indices: [], particleIds: [] };
    }
    const base = this.current.vertices.length;
    this.current.vertices.push(...vertices);
    this.current.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.current.particleIds.push(particle.id);
  }
  flush(): void { if (this.current?.indices.length) this.batches.push(this.current); this.current = null; }
  finish(): readonly Batch[] { this.flush(); return this.batches; }
}
class ParticleSystem3DRenderer {
  constructor(private readonly capacity = 65532) {}
  private quad(particle: Particle): Vertex[] {
    const half = particle.size * 0.5, c = Math.cos(particle.rotation), s = Math.sin(particle.rotation);
    return [[-half, -half, 0, 0], [half, -half, 1, 0], [half, half, 1, 1], [-half, half, 0, 1]].map(([x, y, u, v]) => ({
      x: particle.x + x * c - y * s, y: particle.y + x * s + y * c, u, v, color: [...particle.color],
    }));
  }
  build(particles: readonly Particle[]): readonly Batch[] {
    const visible = particles.filter((particle) => particle.visible).sort((a, b) => b.depth - a.depth);
    const model = new ParticleBatchModel(this.capacity);
    for (const particle of visible) model.append(particle.material, particle, this.quad(particle));
    return model.finish();
  }
}
export function runLesson(): string[] {
  const particles: Particle[] = [
    { id: 1, x: 1, y: 2, depth: 3, size: 1, rotation: 0, color: [1, 0, 0, 1], material: "smoke", visible: true },
    { id: 2, x: 3, y: 2, depth: 1, size: 0.5, rotation: Math.PI / 4, color: [1, 1, 1, 0.7], material: "smoke", visible: true },
    { id: 3, x: 5, y: 2, depth: 2, size: 1, rotation: 0, color: [1, 1, 1, 1], material: "spark", visible: false },
  ];
  const batches = new ParticleSystem3DRenderer(8).build(particles);
  return [
    `visible particles sort back-to-front => ${batches.flatMap((batch) => batch.particleIds).join(", ")}`,
    ...batches.map((batch, i) => `batch ${i}: material=${batch.material}; particles=${batch.particleIds.join(",")}; vertices=${batch.vertices.length}; indices=${batch.indices.join(",")}`),
    `rotated particle vertex[0]=(${batches[0].vertices[0].x.toFixed(2)}, ${batches[0].vertices[0].y.toFixed(2)}); color=${batches[0].vertices[0].color.join(",")}`,
    "source boundary: this is a camera-facing 2D quad/batch model; Creator 2.4 ParticleSystem3DRenderer builds mesh/model data with its own material, texture-sheet and renderer setup",
  ];
}
